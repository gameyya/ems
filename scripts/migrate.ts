#!/usr/bin/env tsx
/**
 * Apply all SQL files in supabase/migrations/ to the linked Postgres database.
 * Uses DATABASE_URL from env (or --connection flag).
 *
 * Tracks applied migrations in public._migrations (filename text primary key).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? process.argv.find((a) => a.startsWith("postgresql://"));

if (!connectionString) {
  console.error("Usage: DATABASE_URL=postgresql://... tsx scripts/migrate.ts");
  process.exit(1);
}

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    create table if not exists public._migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows: applied } = await client.query<{ filename: string }>(
    "select filename from public._migrations",
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip  ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`  apply ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public._migrations (filename) values ($1)", [file]);
      await client.query("commit");
      console.log(`     ✓ ${file}`);
    } catch (err) {
      await client.query("rollback");
      console.error(`     ✗ ${file}:`, (err as Error).message);
      process.exit(1);
    }
  }

  await client.end();
  console.log("Migrations complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
