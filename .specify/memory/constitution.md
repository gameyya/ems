# EMS Constitution

## Core Principles

### I. Static-First, Serverless
The app ships as a static SPA on Cloudflare Pages. No dedicated backend server. All dynamic behavior runs in the browser against Supabase. Any future server-side logic lives in Cloudflare Pages Functions.

### II. Database is the Security Boundary
Row Level Security (RLS), constraints, triggers, and DB functions enforce every rule (roles, financial immutability, unique IDs). The UI is **not trusted**. No privileged keys in the client bundle — only the publishable (anon) key.

### III. Financial Data Integrity
Payment records are immutable after creation. Deletion is forbidden at the DB level; cancellation is a separate write with an audit trail. Receipt numbers are DB-generated (sequence), never client-side.

### IV. Arabic-First, RTL-Native
UI is Arabic with RTL layout by default. All components use logical properties (start/end, not left/right). Fonts support Arabic rendering. Copy lives in `src/i18n/ar.json`.

### V. Fast Data Entry
Forms are keyboard-first, validation is immediate (Zod), common actions are ≤3 keystrokes away. Per SC-001/SC-002: student registration <1 min, payment+receipt <2 min.

### VI. Simplicity & YAGNI
No speculative abstractions. No mocks in place of real Supabase calls. Free-tier-friendly: no extra services, no paid APIs.

## Technology Constraints

- **Frontend**: Vite + React 19 + TypeScript (static build)
- **Styling**: Tailwind v4 + shadcn-style components, RTL via logical properties
- **Database**: Supabase (managed PostgreSQL, free tier)
- **Auth**: Supabase Auth + RLS roles (admin, staff, finance)
- **Router**: react-router-dom v7
- **i18n**: i18next (client-only)
- **Forms**: react-hook-form + zod
- **PDF**: @react-pdf/renderer (browser)
- **Excel**: xlsx (browser)
- **Lint/format**: Biome
- **Hosting**: Cloudflare Pages (static) + GitHub repo

## Development Workflow

- Every user story is specified, planned, tasked, implemented, linted.
- Every DB table must have RLS policies before it holds data.
- Commits follow conventional style; atomic per logical change.
- No PR merges without Biome clean pass.

**Version**: 1.0.0 | **Ratified**: 2026-04-13 | **Last Amended**: 2026-04-13
