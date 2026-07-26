# Household Hub Mobile-First Implementation Progress

**Last updated:** 2026-07-25

**Canonical continuation file:** `progress.md`

**Implementation branch:** `codex/household-hub-mobile-first`

**Implementation worktree:** `/Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first`

**Latest implementation checkpoint:** Tasks 1–6 and the web parity correction
pass are complete and user-accepted (web app done). **Task 7 (Expo foundation
and offline data layer) is complete (self-review), HEAD `edd24dd` plus the 7E
config/metro/progress commit.** 7A–7E done: Expo Router shell + auth gate,
Supabase session, SQLite durable operation queue + device identity, realtime,
deep-link OAuth, Expo Notifications, and a verified iOS Metro bundle. Awaiting
user acceptance before Task 8 (Expo feature parity + visual implementation).

This file is the source of truth for continuing the approved web-first
Household Hub rebuild. Current Git state and fresh verification results take
precedence if this file ever becomes stale. Deep per-task history for the
completed web work lives in `docs/superpowers/progress-detail.md`.

## How to resume safely

1. Work from:

   ```bash
   cd /Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first
   ```

2. Read, in order:

   - `progress.md`
   - `docs/superpowers/plans/2026-07-24-household-hub-web-first-native-parity.md`
     (Task 7 scope)
   - `docs/superpowers/specs/2026-07-24-web-first-household-hub-redesign.md`
   - `docs/mobile-design-reference/README.md` (+ `Household Hub Mobile.dc.html`)
     — drives the native UI (Task 8; Task 7 is foundation only)
   - `CLAUDE.md`
   - `mobile/AGENTS.md` **before changing any Expo code** — it requires reading
     the exact versioned Expo SDK 57 docs at
     `https://docs.expo.dev/versions/v57.0.0/` before writing code
   - `docs/superpowers/progress-detail.md` — deep per-task history (optional)

3. Reconcile the repository before editing:

   ```bash
   git status --short
   git log --oneline -12
   ```

4. Preserve the existing untracked reference/scaffold files unless the active
   task explicitly brings them into scope:

   - `DEPLOYMENT.md`
   - `docs/mobile-design-reference/`
   - `docs/mobile-implementation-handoff.md`
   - the still-untracked files under `mobile/`

5. **Task 7 is complete (self-review); Task 8 is the next task.** Task 8 = Expo
   feature parity + visual implementation. Build the five tabs, header actions,
   detail stacks, modal/sheet flows, and design tokens against
   `docs/mobile-design-reference/` (Heroicons, React Native SVG, TenTap), reusing
   the shared contracts already wired in Task 7:

   - Shared domain: `packages/domain/src/` (consumed via `@household-hub/domain`;
     bundles into the Expo app — verified by `expo export`).
   - Native durable queue: `mobile/src/lib/operations/` (`enqueueOperation`,
     `withOptimisticOverlay`, `useHouseholdRealtime`, `explainDiscard`) — same
     command contract as the web `src/lib/operations/`. Feature mutations should
     call `enqueueOperation`, not write tables.
   - Native Supabase client + auth: `mobile/src/lib/supabase.ts`,
     `mobile/src/lib/auth/`. Session gate + OAuth deep links already work.
   - `mobile/app/(tabs)/*` currently render `PlaceholderScreen`; replace them.
   - **Mount `useHouseholdRealtime(householdId)`** once feature reads expose the
     household id.

   Native environment variables are `EXPO_PUBLIC_SUPABASE_URL` /
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `mobile/.env.example`), plus
   `EXPO_PUBLIC_ENABLE_TEST_AUTH=true` to show the local email/password form;
   native scheme is `householdhub://`, app id `com.conlegs.householdhub`,
   portrait phones only. **Run mobile commands from `mobile/`** (not the worktree
   root — the jest/tsc config lives there); prefix Node with
   `PATH="/opt/homebrew/bin:$PATH"`. Mobile verification is `npm test` (jest) +
   `npm run typecheck` + `npx expo export --platform ios` for a bundle check. Use
   TDD for behavior changes and update `progress.md` at **every sub-checkpoint**.

6. **Deferred cleanup (safe, no behavior impact):** the legacy page-based
   screens/hooks/components (`src/components/pages|budget|savings|groceries|
   trips|notes`, `src/hooks/useBudget|useSavings|usePages|useTrip|useGroceries|
   useCalendar`, `src/routes/PageView|SectionListPage`, and their tests) remain
   in the tree but are **fully unrouted and unreferenced by the rebuilt web
   route graph** (verified by grep from `App.tsx` through `features/`, `shell/`,
   `components/auth/`). The functional retirement requirement is met. Physically
   deleting that dead code (~15 files + tests) is deferred to its own commit
   before merge or during Task 9 cleanup.

## Approved product direction

- Rebuild and validate the web application first. **(Done and accepted.)**
- Phone web and native follow the supplied mobile design reference.
- Desktop web keeps a wider left navigation pane with the same behavior.
- Primary destinations are Calendar, Groceries, Ledger, Notes, and Trips.
- Calendar is the default destination. There is no Home destination.
- The header contains the rabbit/penguin identity, Notifications, and Settings.
- Notes retain multiple named documents.
- Web, iOS, and Android use one Supabase backend and one shared domain contract.
- Native targets portrait phones only.
- Production application data will start empty, but the production reset must
  not run until a separate release-time approval.

## Progress summary

| Task | Status | Completion |
| --- | --- | --- |
| 1. Shared foundation and domain contracts | Complete | Review-clean at `ffc3c01` |
| 2. Supabase schema and operation RPC | Complete | Review-clean at `d1f3e30` |
| 3. Identity, notifications, jobs, deployment config | Complete | Verified at `24a5b39` (self-review) |
| 4. Durable web operation queue | Complete | Verified at `f86f4c0` |
| 5. Responsive web shell and visual system | Complete | Verified at `626c681` |
| 6. Web feature flows | Complete | 6A–6F done; verified at `eafdce8` |
| Pre-7. Authenticated local test setup | Complete | Verified at `c5dc6d3`; real two-member Supabase household |
| Web parity correction pass (1–6) | Complete & accepted | Final handoff at `edd24dd` era |
| **7. Expo foundation and offline data layer** | **Complete (self-review)** | 7A–7E done; verified at `edd24dd`+config; awaiting user acceptance |
| 8. Expo feature parity and visual implementation | Pending | Not started |
| 9. Reset procedure, E2E verification, release handoff | Pending | Not started |

Per-task narratives, sub-checkpoints, and live-evidence logs for Tasks 1–6 and
the correction pass are archived in `docs/superpowers/progress-detail.md`.

## Task 7 — Expo foundation and offline data layer (complete, self-review)

Scope (from the plan): replace the Expo scaffold with Expo Router, shared domain
package consumption, Supabase session storage, OAuth/deep links, a SQLite query
cache and durable operation queue, secure device/session identifiers, Realtime
reconciliation, and Expo Notifications. Configure `householdhub://` callbacks,
`com.conlegs.householdhub`, portrait-only phones, system appearance, iOS and
Android development builds, and EAS profiles. Add Jest/React Native Testing
Library coverage for navigation, queue persistence/replay/conflicts,
authentication gates, deep links, timezone helpers, and currency presentation.

**Starting scaffold state** (`mobile/`, mostly untracked): default Expo SDK 57
`App.tsx`/`index.ts`; `app.json` + `eas.json` already carry the scheme, bundle
id, portrait lock, and EAS profiles; `@household-hub/domain` already declared as
a `file:` dependency; `metro.config.js` uses the default workspace-aware Expo
config; `.env.example` documents the `EXPO_PUBLIC_*` anon-scoped vars.

Sub-checkpoints:

- **7A — Expo Router foundation, auth gate, session wiring (done, `c834135`).**
  Installed the SDK 57 native module set (expo-router, sqlite, secure-store,
  notifications, async-storage, netinfo, crypto, auth-session/web-browser,
  supabase-js, react-query) + a jest-expo/RNTL test harness. `mobile/app/`:
  root `_layout` (SafeArea + QueryClient + AuthProvider + `<Stack>`), a five-tab
  group (`(tabs)/` — Calendar `index` default, groceries/ledger/notes/trips),
  and `login`/`settings`/`notifications` routes; feature screens are
  `PlaceholderScreen`s until Task 8. `src/lib/supabase.ts` persists the session
  to AsyncStorage with AppState-driven `startAutoRefresh`/`stopAutoRefresh`.
  Auth gate = pure `resolveAuthRedirect` (unit-tested) wired through
  `useAuthGate` (`src/lib/auth/gate.ts`). OAuth = `householdhub://auth/callback`
  PKCE via expo-web-browser + a pure `parseAuthCallback`; local email/password
  is gated behind `EXPO_PUBLIC_ENABLE_TEST_AUTH`. **Verification:** `npm test`
  **12 passed / 4 suites**, `npm run typecheck` clean.
  - Harness notes for later checkpoints: mobile pins React 19.2.3 (Expo) vs the
    root web app's 19.2.7, so `jest` `moduleNameMapper` forces a single React
    copy and `react-test-renderer@19.2.3` matches it. `renderRouter` switches on
    fake timers and does not reset expo-router's global store between calls, so
    **one `renderRouter` per test file** (extra route-wiring scenarios get their
    own file, e.g. `gate.signedIn.test.tsx`); the exhaustive redirect matrix
    lives in the pure `redirect.test.ts`.

- **7B/7C — SQLite durable operation queue + device identity (done, `ab2f619`).**
  Ported the web durable queue onto expo-sqlite behind an `OperationStore`
  interface (`src/lib/operations/store.ts`): the SQLite impl (`src/lib/db/
  sqlite.ts`) backs the app; `InMemoryOperationStore` backs the tests, so the
  FIFO/replay/conflict rules are tested without a native bridge (exactly as the
  web queue is tested against fake-indexeddb). `queue.ts` keeps the web
  contract verbatim — durable-first enqueue, FIFO replay that **stops** on a
  transport failure, applied/duplicate removal, permanent conflict/rejection
  discards with `explainDiscard` (copied verbatim), optimistic overlay. RN swaps:
  `navigator.onLine`→`@/lib/net` (NetInfo), `crypto.randomUUID`→`@/lib/uuid`
  (WebCrypto in tests / expo-crypto on device), window/visibility events→NetInfo
  + AppState + interval. Secure per-install **device id** in expo-secure-store
  (`@/lib/secure`); transactional local sequence in the store. Realtime hook
  (`realtime.ts`) mirrors web. **Verification:** 15 queue/device tests; full
  suite **27 passed / 6 suites**, tsc clean.
- **7D — Deep-link OAuth, notifications, sync loop, presentation (done, `edd24dd`).**
  `useOperationSync` mounts the queue for the app lifetime (hands it the React
  Query client + starts reconnect/foreground/interval replay); wired into the
  root `_layout`. `useOAuthDeepLinks` completes the `householdhub://` PKCE flow
  on cold start (`getInitialURL`) and warm redirect (`addEventListener`), reusing
  the pure `parseAuthCallback`. `src/lib/notifications.ts` registers for the Expo
  push token (permission prompt, null on simulator, foreground banner handler).
  `src/lib/format.ts` adds shared money/timezone presentation over the domain.
  **Verification:** notifications (4) + format currency/timezone (6) tests; full
  suite **37 passed / 8 suites**, tsc clean.
- **7E — Config finalization + full verification (done).** `metro.config.js`
  made monorepo-correct: watch the workspace root, resolve from both
  node_modules paths, and **force a single React copy** into the bundle (the
  root web app pins 19.2.7, Expo pins 19.2.3 — two on disk, but a RN bundle must
  contain exactly one React). `app.json` finalized: `expo-notifications` plugin
  (accent `#FF7A45`), typed-routes experiment, `userInterfaceStyle: automatic`
  (system appearance), portrait lock, `householdhub` scheme, and bundle/app id
  `com.conlegs.householdhub` (all validated by `expo config`). `@types/jest`
  pinned to 29.5.x to match jest 29. **Verification:** full Jest **37 passed /
  8 suites**; `tsc --noEmit` clean; `expo config` valid; `expo-doctor` **19/20**
  (only the on-disk React duplicate, mitigated in-bundle by the Metro resolver);
  **`expo export --platform ios` bundles cleanly (1283 modules, Hermes
  bytecode)** — proving the Metro monorepo config and shared-domain resolution
  end to end.

**What Task 7 deliberately did NOT do** (belongs to Task 8/9):
  - Feature screens are `PlaceholderScreen`s (Task 8 implements the five flows).
  - `useHouseholdRealtime` is built but not yet mounted with a real household id
    (needs the household context that arrives with Task 8 feature reads).
  - No physical-device / EAS build, no push registered against Expo's servers,
    no OAuth provider round-trip — those are Task 9 device/release validation.
  - No mobile ESLint config yet (Task 7 gates are Jest + tsc + bundle; `expo
    lint` setup is a reasonable Task 8/9 addition).
  - No independent review agent ran (session directive: self-review). A native
    `/code-review` pass is the recommended pre-merge follow-up, alongside the
    web branch review.

**Known caveat carried forward:** the on-disk React duplicate (19.2.3 vs 19.2.7)
is a monorepo artifact of the accepted web app's React pin. It is mitigated for
the native bundle by the Metro single-React resolver and for tests by the jest
`moduleNameMapper`. A permanent fix (aligning both packages on one React) is a
cross-cutting change to the accepted web checkpoint and was deliberately not
made under Task 7; revisit during Task 9 dependency hardening.

**Next gate:** review the mobile foundation, then approve Task 8 (Expo feature
parity + visual implementation against `docs/mobile-design-reference/`).

## Environment, constraints & risks (condensed)

- **Local sign-in is enabled and required.** `RequireAuth` (web) requires a real
  Supabase session; the ignored `.env.local` has `VITE_ENABLE_TEST_AUTH=true`,
  which exposes the email/password form only in the local/test build. Production
  authentication is Google and Apple OAuth only.
- **Local test household:** `🐰 & 🐧 Test`, provisioned through the real
  `onboard_household` + invite-redemption path with Yongju as owner and Claire
  as member.

  | Member | Email | Password | Role |
  | --- | --- | --- | --- |
  | Yongju | `yongju@test.local` | `household123` | Owner |
  | Claire | `claire@test.local` | `household123` | Member |

  Start the local stack and app with:

  ```bash
  PATH="/opt/homebrew/bin:$PATH" npx supabase start
  PATH="/opt/homebrew/bin:$PATH" npm run dev
  ```

  Re-running `scripts/seed-household.ts` with the same household and credentials
  is idempotent: it reuses the accounts and membership without clearing feature
  data.
- **Run from this worktree** (`codex/household-hub-mobile-first`), not the main
  checkout — different branch.
- **Prefix Node commands with `PATH="/opt/homebrew/bin:$PATH"`** — the Rosetta
  x64 node breaks `npm test`/`build` (arch mismatch); arm64 runs clean. Supabase
  CLI must be ≥ 2.109.
- **Migrations go to both DBs separately:** `supabase db push` (cloud) and
  `supabase db reset` / `migration up` (local).
- **Nothing is deployed** — all verification is local; no hosted Supabase,
  Vercel, or EAS build touched. Production data untouched. **Do not run the
  production reset** (Task 9; needs explicit release approval).
- **No independent review agent has run for Tasks 3–6** (session directive: no
  subagents) — self-review + live end-to-end only. `/code-review` on this branch
  is the recommended pre-merge follow-up.
- **Legacy membership preflight:** the one-user/one-household unique constraint
  fails if legacy data has a user in multiple households — resolve before a
  hosted deploy.
- Carried-forward risks (permanently-failing push batch, Expo push not yet
  exercised against Expo's servers, live two-client Realtime) are in the
  archive.

## Full detail

Architecture diagrams, per-task narratives (including the full Task 5, Task 6,
and web parity correction records), per-task verification baselines, reviews,
and the original task scope live in `docs/superpowers/progress-detail.md`.
Current git state + fresh verification always take precedence over both files.
