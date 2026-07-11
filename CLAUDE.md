# Household Hub

Shared budget/trips/groceries/notes PWA for two people (iPhone/Mac + Android). Full architecture, data model, and phase breakdown: `/Users/conlegs/.claude/plans/witty-weaving-lobster.md` — read that first for anything not covered here.

Design reference (Claude Design prototype, kept in sync as UI details get refined): https://claude.ai/design/p/e3b80ab8-cd0d-4cd0-853f-8a61f4721192 — `Household Hub.dc.html` (shell/nav) and `Detail.dc.html` (per-section templates: Budget/Trips/Groceries/Notes) show the target interaction patterns (inline add/edit forms, swipe/hover row actions, long-press page delete).

## Stack

Vite + React 19 + TypeScript, npm, Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first `@theme`, no `tailwind.config.js`), shadcn/ui (Radix primitives), Supabase (Postgres/Auth/Realtime), Tiptap for rich text, Dexie for the offline outbox, TanStack React Query, react-router-dom, vite-plugin-pwa. Mirrors conventions from `~/dev/kdd-website-new` (ESLint flat config, Prettier, `src/lib/supabase.ts` client pattern).

## Commands

- `npm run dev -- --host` — dev server reachable from other devices on the LAN (needed to test on the iPhone/Pixel against a Mac-hosted dev server)
- `supabase migration new <name>` / `supabase db push` — schema changes (never hand-edit via the dashboard SQL editor)
- `supabase gen types typescript --project-id <id> > src/types/database.ts` — regenerate types after any migration
- `npm run build` — production build (Vercel picks this up automatically on push)

## Conventions

- Migrations live in `supabase/migrations/`, named with the Supabase CLI's timestamp style (`YYYYMMDDHHMMSS_description.sql`, e.g. `20260711001811_core.sql`), one per build phase (see plan's Build Phases table).
- Every tenant-scoped table gets a denormalized `household_id` + RLS policy — see the `supabase-rls-tenant-scoping` skill for the exact pattern, don't reinvent it per table.
- Realtime subscriptions and offline writes follow the `supabase-realtime-query-sync` and `offline-mutation-outbox` skills respectively — same reasoning: don't hand-roll a variant per feature.
- No signup UI — invite-only, both accounts provisioned via a one-off seed script using the service-role key (see plan Phase 0).
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored); `.env.example` documents the shape.

## Deploy

Vercel, framework preset "Vite", build `npm run build`, output `dist`. `vercel.json` SPA rewrite required (see plan's Deployment section). Env vars set in the Vercel dashboard, not committed. When the hosted Supabase project is created, disable signups in its dashboard (Authentication → Sign In / Up) to match the local `enable_signup = false` config — this is an invite-only app.
