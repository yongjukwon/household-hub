# Task 1: Project Scaffold (Phase 0a)

Create the Vite + React + TypeScript scaffold for Household Hub in `/Users/conlegs/dev/household-hub` (repo already exists with CLAUDE.md; work on the current branch `phase-0-scaffold-auth`).

## Steps

Scaffold in place (the repo root IS the app root — do not create a nested subdirectory). `npm create vite@latest . -- --template react-ts` may complain about existing files (CLAUDE.md, .superpowers/); if so, scaffold into a temp dir and move files in, preserving CLAUDE.md and .superpowers/.

Install:

```bash
npm install @supabase/supabase-js class-variance-authority clsx tailwind-merge lucide-react \
  react-router-dom @tanstack/react-query dexie recharts \
  @tiptap/react @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item \
  @tiptap/extension-placeholder
npm install -D tailwindcss @tailwindcss/vite prettier eslint-config-prettier \
  @types/node vite-plugin-pwa vitest @testing-library/react @testing-library/jest-dom jsdom
```

Then `npx shadcn@latest init` (choose defaults suitable for Vite + Tailwind v4; non-interactive flags like `-d` / `--yes` where possible) and `npx shadcn@latest add button input dialog checkbox tabs progress card sheet dropdown-menu label separator popover badge calendar`.

## Required configuration

- **vite.config.ts**: `react()` + `@tailwindcss/vite` plugins, `@` path alias to `src/`, and a `test` block for vitest (environment `jsdom`, globals true, setup file `src/test/setup.ts` containing the jest-dom import). Do NOT add vite-plugin-pwa config yet — the dependency is installed now, wiring happens in a later phase.
- **src/index.css**: Tailwind v4 CSS-first setup — `@import "tailwindcss";` plus an `@theme`/CSS-variables block defining the app's design tokens (light + dark). Use these exact values from the approved design prototype:

  Light: `--canvas:#e7e6e1; --winbg:#ffffff; --sidebar:#f6f5f2; --panel:#ffffff; --text:#22211d; --meta:#96958d; --faint:#c7c6bf; --line:rgba(0,0,0,.08); --line2:rgba(0,0,0,.05); --accent:#b1811f; --accentSoft:rgba(177,129,31,.12); --sel:rgba(177,129,31,.13); --hover:rgba(0,0,0,.045); --track:rgba(0,0,0,.08); --barbg:#dcdbd3; --danger:#b5493a; --onaccent:#fff;`

  Dark (via `@media (prefers-color-scheme: dark)` on `:root:not([data-theme])` AND a `[data-theme="dark"]` selector so a manual toggle can override): `--canvas:#0e0e0d; --winbg:#1d1c1a; --sidebar:#252421; --panel:#1d1c1a; --text:#ecebe4; --meta:#8d8c84; --faint:#54534d; --line:rgba(255,255,255,.09); --line2:rgba(255,255,255,.05); --accent:#e0b45f; --accentSoft:rgba(224,180,95,.15); --sel:rgba(224,180,95,.16); --hover:rgba(255,255,255,.05); --track:rgba(255,255,255,.1); --barbg:#3a3934; --danger:#e0796a; --onaccent:#241f16;`

  Font stack: `-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif` on body, with `-webkit-font-smoothing:antialiased`.
- **eslint.config.js**: flat config — js.recommended + typescript-eslint recommended + react-hooks + react-refresh + eslint-config-prettier, with `dist` and `dev-dist` ignored. (Reference: `/Users/conlegs/dev/kdd-website-new/eslint.config.js` — copy its shape.)
- **.prettierrc**: copy from `/Users/conlegs/dev/kdd-website-new/.prettierrc` verbatim.
- **.env.example**: `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` lines. Ensure `.gitignore` covers `.env` and `.env.local`.
- **src/lib/supabase.ts**: `createClient` from `@supabase/supabase-js`, reading `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, with `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }`. (Reference: `/Users/conlegs/dev/kdd-website-new/src/lib/supabase.ts`.)
- **Folder structure** (create dirs, empty or with placeholder index files only where a file is genuinely needed — no speculative stubs):
  `src/routes/`, `src/components/ui/` (shadcn output), `src/components/layout/`, `src/components/pages/`, `src/components/budget/`, `src/components/trips/`, `src/components/groceries/`, `src/components/notes/`, `src/components/auth/`, `src/hooks/`, `src/lib/`, `src/lib/offline/`, `src/types/`, `src/test/`
- Strip the Vite template's demo content (logo counter app, App.css) — `App.tsx` renders a minimal placeholder (e.g. the app name styled with the design tokens) until routing lands in a later task.

## Done means

- `npm run build` succeeds
- `npx eslint .` passes clean
- `npx vitest run` passes (add one smoke test, e.g. App renders, to prove the test wiring works)
- `npm run dev` starts and serves the placeholder (verify with curl, don't leave it running)
- All work committed on `phase-0-scaffold-auth` (do not commit `node_modules`, `.env*` except `.env.example`)

No TDD required for this task (it's configuration/scaffolding, not behavior), but the smoke test above must be real and passing.
