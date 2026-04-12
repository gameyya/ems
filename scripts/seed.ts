#!/usr/bin/env tsx
/**
 * Seed the EMS database:
 *  - Create initial Admin user in auth.users (via SQL, since we don't have service-role key)
 *  - Create matching profile row with role='admin'
 *  - Ensure settings row exists
 *
 * Generates a temporary password if SEED_ADMIN_PASSWORD is not provided and writes
 * credentials to info-dir/ems-creds.md (which is git-excluded).
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "gameyya.quraan@gmail.com";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "مدير النظام";
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ?? `Ems-${randomBytes(8).toString("base64url")}!`;

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Create admin auth user (using Supabase's internal password-hashing function
  //    accessible via the pgcrypto-style crypt function + auth.users insert).
  //    Safer: use the auth schema's built-in function when available; fallback to
  //    inserting with crypt('...','bf').
  await client.query("create extension if not exists pgcrypto;");

  const existing = await client.query<{ id: string }>(
    "select id from auth.users where email = $1",
    [ADMIN_EMAIL],
  );

  let userId: string;
  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
    // Reset password to the current ADMIN_PASSWORD so creds file is always valid
    await client.query(
      "update auth.users set encrypted_password = crypt($1, gen_salt('bf')), updated_at = now() where id = $2",
      [ADMIN_PASSWORD, userId],
    );
    // Ensure identity row exists for email login
    await client.query(
      `
      insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      values (
        gen_random_uuid(), $1::uuid,
        jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true),
        'email', $2, now(), now(), now()
      )
      on conflict (provider, provider_id) do nothing;
      `,
      [userId, ADMIN_EMAIL],
    );
    console.log(`Admin user already exists; password reset: ${ADMIN_EMAIL} (${userId})`);
  } else {
    const result = await client.query<{ id: string }>(
      `
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      )
      values (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        $1,
        crypt($2, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', $3::text),
        now(),
        now(),
        '', '', '', ''
      )
      returning id;
      `,
      [ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME],
    );
    userId = result.rows[0].id;

    // Create a matching identity row so email login works in some Supabase versions
    await client.query(
      `
      insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      values (
        gen_random_uuid(), $1::uuid,
        jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true),
        'email', $2, now(), now(), now()
      )
      on conflict do nothing;
      `,
      [userId, ADMIN_EMAIL],
    );
    console.log(`Created admin user: ${ADMIN_EMAIL} (${userId})`);
  }

  // 2. Create/upsert profile with admin role
  await client.query(
    `
    insert into public.profiles (id, full_name, role)
    values ($1, $2, 'admin')
    on conflict (id) do update set full_name = excluded.full_name, role = 'admin';
    `,
    [userId, ADMIN_NAME],
  );

  // 3. Ensure settings row
  await client.query(`
    insert into public.settings (id) values (1) on conflict do nothing;
  `);

  await client.end();

  // 4. Write creds to info-dir (git-excluded)
  const credsPath = join(process.cwd(), "info-dir", "ems-creds.md");
  const content = `# EMS Credentials

> ⚠️ This file is git-excluded (see \`.git/info/exclude\`). Do NOT commit.

## Admin login

- **Email**: ${ADMIN_EMAIL}
- **Password**: \`${ADMIN_PASSWORD}\`
- **User ID**: ${userId}
- **Role**: admin

Log in at the app and change this password immediately from Settings.

## Database

- **Pooler URL (IPv4)**: \`postgresql://postgres.zblpuejrfbmfaecvqrju:***@aws-0-eu-west-1.pooler.supabase.com:5432/postgres\`
- **Direct URL (IPv6-only)**: \`postgresql://postgres:***@db.zblpuejrfbmfaecvqrju.supabase.co:5432/postgres\`
- **Region**: eu-west-1

## Seeded at

${new Date().toISOString()}
`;
  writeFileSync(credsPath, content, { mode: 0o600 });
  console.log(`\nCredentials written to: ${credsPath}`);
  console.log(`\n🔐 Admin email:    ${ADMIN_EMAIL}`);
  console.log(`🔐 Admin password: ${ADMIN_PASSWORD}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
