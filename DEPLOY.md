# Deployment Guide

## Stack
- Frontend: Vite + React + TypeScript (static SPA)
- Hosting: Cloudflare Pages (free)
- Backend: Supabase free tier (Postgres + Auth + RLS)

## Environment Variables
Set these in Cloudflare Pages → Settings → Environment Variables:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon public key from Supabase → Settings → API |

## Cloudflare Pages Setup
1. Log in at https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git.
2. Authorize GitHub and pick this repo.
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: `20` (set `NODE_VERSION=20` env var if needed)
4. Add the env vars above for **Production** (and Preview if desired).
5. Deploy.

## SPA Routing
React Router needs all unknown paths routed to `index.html`. A `_redirects` file in `public/` handles this:

```
/*  /index.html  200
```

## Database Setup
Run migrations once against the Supabase project:

```bash
DB_URL="postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
npm run db:migrate
npm run db:seed   # creates initial admin; credentials written to info-dir/ems-creds.md
```

The seed uses `ADMIN_EMAIL` env var (defaults to the address configured in `scripts/seed.ts`).

## Post-deploy Checklist
- [ ] Log in with admin credentials.
- [ ] Update institution name in Settings.
- [ ] Create staff/finance users in Supabase Auth, then insert matching `profiles` rows with the role.
- [ ] Rotate the bootstrap admin password.
