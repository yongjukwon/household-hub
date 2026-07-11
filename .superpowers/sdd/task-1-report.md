# Task 1: Project Scaffold — Report

## What I implemented

Scaffolded the repo root in place with `npm create vite@latest . -- --template react-ts`
(via a temp dir, moving files in and stripping demo assets, since CLAUDE.md and
`.superpowers/` already existed). Installed all runtime and dev dependencies from the
brief, plus the ESLint core packages the brief's `eslint.config.js` spec requires but
its install command didn't list (see Deviations). Ran `npx shadcn@latest init` and
`npx shadcn@latest add` for all 14 requested components.

Configuration delivered per the brief:
- `vite.config.ts` — `react()` + `@tailwindcss/vite`, `@` → `src/` alias, `test` block
  (jsdom, globals, `src/test/setup.ts`).
- `src/index.css` — Tailwind v4 `@import "tailwindcss"`, exact light/dark design tokens
  from the brief (`:root`, `@media (prefers-color-scheme: dark)` on
  `:root:not([data-theme])`, and `[data-theme="dark"]`), the specified font stack on
  `body`. shadcn's own init appended its own semantic tokens (`--background`,
  `--primary`, etc.) and a `.dark` class block underneath — see Deviations for the one
  collision this caused.
- `eslint.config.js` — flat config matching kdd-website-new's shape (js.recommended +
  typescript-eslint recommended + react-hooks + react-refresh + eslint-config-prettier,
  `dist`/`dev-dist` ignored), plus one small addition (see Deviations).
- `.prettierrc` — copied verbatim from kdd-website-new.
- `.env.example` — `VITE_SUPABASE_URL=` / `VITE_SUPABASE_ANON_KEY=`; `.gitignore`
  covers `.env` and `.env.local` (added, template didn't have them) plus `dev-dist`.
- `src/lib/supabase.ts` — `createClient` reading the two `VITE_*` env vars, with
  `persistSession`/`autoRefreshToken`/`detectSessionInUrl`, modeled on
  kdd-website-new's version (dropped a stale `eslint-disable` comment that no rule in
  this config actually needs).
- Folder structure created exactly as listed in the brief.
- `App.tsx` is a minimal placeholder rendering "Household Hub" styled with
  `var(--canvas)`/`var(--text)`; all Vite template demo content (counter, logos,
  `App.css`, `icons.svg`, `hero.png`) was removed, never copied into the repo.

## Deviations from the brief (and why)

1. **Node version.** The environment's default Node is v20.15.1; Vite 8 (what
   `npm create vite@latest` installed today) requires `>=20.19` or `>=22.12`. I used
   `nvm use v25.8.2` (already installed) for all install/build/test/dev commands, and
   added `.nvmrc` (`v25.8.2`) plus `"engines": { "node": ">=20.19.0" }` in
   `package.json` so this is documented and reproducible. Everything still *works*
   under 20.15.1 (Vite just prints a warning), so this isn't a hard blocker, but the
   pin avoids repeat warnings for later tasks.

2. **ESLint packages not in the brief's install command.** The brief's install list
   only includes `eslint-config-prettier`, not `eslint`/`@eslint/js`/`typescript-eslint`/
   `eslint-plugin-react-hooks`/`eslint-plugin-react-refresh`/`globals`. That's because
   older Vite templates used to ship ESLint by default — this Vite version (8.x)
   ships **oxlint** instead (`.oxlintrc.json`, `"lint": "oxlint"`). Since the brief
   explicitly requires an ESLint flat config matching kdd-website-new, I removed
   `.oxlintrc.json`/oxlint entirely and `npm install -D`'d the six ESLint packages
   needed to build that config.

3. **`eslint-plugin-react-hooks@7.1.1`'s `recommended-latest` export is shaped for
   eslintrc, not flat config** (`plugins: ["react-hooks"]`, an array — flat config
   requires an object). This is a newer major version than what kdd-website-new pins
   (`^5.2.0`); npm installed latest since the brief didn't pin a version. Fixed by
   using `reactHooks.configs.flat['recommended-latest']` instead, which is the
   correctly-shaped flat variant the same package exposes.

4. **shadcn's Nova preset token names collided with two of the brief's exact token
   names**: `--accent` and `--sidebar`. shadcn's init wrote its own `oklch(...)`
   values into those two keys inside the shared `:root` block (shadcn's own
   `--accent-foreground`, `--sidebar-foreground`, etc. lived alongside them without
   collision). I restored `--accent: #b1811f` and `--sidebar: #f6f5f2` (the brief's
   exact light-mode values) after init; confirmed `components/ui/button.tsx` and the
   other generated components key off `--primary`/`--background`/etc., not `--accent`,
   so this doesn't visually break the shadcn defaults. The dark-mode blocks
   (`[data-theme="dark"]` and the `@media` one) were untouched by init since shadcn's
   own dark tokens live in a separate `.dark` class block — no collision there.

5. **shadcn CLI wrote every generated file to a literal `./@/...` directory** instead
   of resolving the `@/` alias to `src/`, both on `init` (button.tsx, lib/utils.ts) and
   on the subsequent `add` call (14 more files) — despite its own "Validating import
   alias" step reporting success. I moved the files into `src/components/ui/` and
   `src/lib/` and deleted the stray `@/` directory each time; verified the alias
   resolves correctly in actual app code via the passing build/tests. Root tsconfig
   paths already point at `src/*` (added to `tsconfig.app.json`, not the root
   `tsconfig.json`, matching this template's project-references split) — this looks
   like a quirk in `shadcn@4.13.0`'s handling of split tsconfig project references
   rather than something wrong in this repo's config, but flagging it in case it
   recurs on a later task's `shadcn add` call.

6. **`react-refresh/only-export-components` fires on shadcn's own generated files**
   (`badge.tsx`, `button.tsx`, `tabs.tsx` each pair a component with an exported
   `cva()` variants helper). `allowConstantExport: true` — already the default in
   `reactRefresh.configs.vite` — doesn't cover function-call exports like this. Added
   a small override block in `eslint.config.js` disabling that one rule for
   `src/components/ui/**/*` (vendored shadcn output), rather than touching the
   generated files or weakening the rule project-wide.

7. **`tsconfig.app.json`'s `baseUrl`** triggered a TS5101 deprecation error under
   TypeScript 6.0.2 (bundled with today's Vite scaffold). Removed `baseUrl` — not
   needed for `paths` to resolve under `moduleResolution: "bundler"`.

8. Per the brief, empty directories (`src/routes`, `src/hooks`, `src/types`,
   `src/lib/offline`, and the empty `src/components/*` feature folders) were created
   locally but git doesn't track empty directories, so they won't appear after
   checkout until a later task adds files to them. This is expected/consistent with
   "no speculative stubs."

## Verification commands run

```
$ npm run build
> tsc -b && vite build
✓ built in 139ms   (dist/index.html, index-*.css 60.12kB, index-*.js 190.66kB)

$ npx eslint .
(no output — exit 0)

$ npx vitest run
 Test Files  1 passed (1)
      Tests  1 passed (1)

$ npm run dev   (backgrounded, then curled, then killed)
VITE v8.1.4 ready in 129 ms
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
200
(response body confirmed <title>Household Hub</title> and #root/main.tsx script tag)
```

`dist/` was removed after each build check; no dev server left running.

## Files changed

New files (see `git show --stat 051979c` for the full list), most relevant:
- `/Users/conlegs/dev/household-hub/vite.config.ts`
- `/Users/conlegs/dev/household-hub/eslint.config.js`
- `/Users/conlegs/dev/household-hub/.prettierrc`
- `/Users/conlegs/dev/household-hub/.env.example`
- `/Users/conlegs/dev/household-hub/.gitignore`
- `/Users/conlegs/dev/household-hub/.nvmrc`
- `/Users/conlegs/dev/household-hub/src/index.css`
- `/Users/conlegs/dev/household-hub/src/App.tsx`
- `/Users/conlegs/dev/household-hub/src/lib/supabase.ts`
- `/Users/conlegs/dev/household-hub/src/lib/utils.ts` (shadcn-generated `cn()` helper)
- `/Users/conlegs/dev/household-hub/src/test/setup.ts`
- `/Users/conlegs/dev/household-hub/src/test/App.test.tsx`
- `/Users/conlegs/dev/household-hub/src/components/ui/*.tsx` (14 shadcn components)
- `/Users/conlegs/dev/household-hub/components.json` (shadcn config)
- `/Users/conlegs/dev/household-hub/tsconfig.app.json` / `tsconfig.json` / `tsconfig.node.json`
- `/Users/conlegs/dev/household-hub/package.json` / `package-lock.json`

## Self-review findings

- Completeness: every item in "Required configuration" and "Done means" is present
  and verified.
- Quality: no leftover Vite demo content (`App.css`, logos, counter, `icons.svg`,
  `hero.png` never made it into the repo); `.DS_Store` removed and confirmed
  gitignored; prettier applied to all hand-authored files (shadcn's vendored
  `components/ui/*.tsx` intentionally left in its own double-quote style, matching
  how such generated code is normally treated).
- Discipline: no speculative stub files added beyond what the brief lists; didn't
  wire `vite-plugin-pwa` (installed only, per instruction).
- Verification: build/lint/test/dev all actually run and observed passing (output
  above), not assumed.

## Concerns

- Items 3–6 above stem from this being scaffolded against genuinely bleeding-edge
  package versions (Vite 8, shadcn 4.13, eslint-plugin-react-hooks 7.x, TypeScript 6,
  React 19.2) rather than the somewhat older versions kdd-website-new pins. Everything
  verified working, but a later task running `npx shadcn add <more>` should expect the
  same "writes to `./@/...`" quirk and know to move the files into `src/`.
- `shadcn` itself ended up as a `dependencies` entry (not `devDependencies`) —
  that's the CLI's own default behavior on `init`/`add`, left as-is.
