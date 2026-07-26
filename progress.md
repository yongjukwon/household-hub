# Household Hub Mobile-First Implementation Progress

**Last updated:** 2026-07-25

**Canonical continuation file:** `progress.md`

**Implementation branch:** `codex/household-hub-mobile-first`

**Implementation worktree:** `/Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first`

**Latest implementation checkpoint:** Tasks 1–6 and the web parity correction
pass are complete and user-accepted (web app done). **Task 7 (Expo foundation
and offline data layer) is complete and user-accepted**, HEAD `a41c92c`. 7A–7E
done: Expo Router shell + auth gate, Supabase session, SQLite durable operation
queue + device identity, realtime, deep-link OAuth, Expo Notifications, and a
verified iOS Metro bundle. **User acceptance evidence:** built and ran the real
SDK 57 app end-to-end on a local iOS Simulator (iPhone 17, iOS 26.5) via
`expo run:ios` — signed in with the local test account and navigated the
five-tab shell. (Expo Go could not be used: its public build only supports SDK
54, one behind this project's deliberate SDK 57 baseline — see
`mobile/AGENTS.md`. EAS dev-client / TestFlight on the user's physical iPhone
is pending Apple Developer Program enrollment, tracked separately.)
**Task 8 (Expo feature parity and visual implementation) is now the active
task** — the user approved starting it.

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

5. **Task 7 is complete and user-accepted; Task 8 is the active task.** Task 8 = Expo
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
| 7. Expo foundation and offline data layer | Complete & accepted | 7A–7E done; user-accepted on a real iOS Simulator build at `a41c92c` |
| **8. Expo feature parity and visual implementation** | **In progress** | **Active task** |
| 9. Reset procedure, E2E verification, release handoff | Pending | Not started |

Per-task narratives, sub-checkpoints, and live-evidence logs for Tasks 1–6 and
the correction pass are archived in `docs/superpowers/progress-detail.md`.

## Task 7 — Expo foundation and offline data layer (complete, user-accepted)

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

- **7F — Real-device validation + acceptance (done, `a41c92c`).** Fixed a real
  npm-hoisting bug found only by actually running the dev server: `expo-router`
  is declared as an *optional* peer of `@expo/cli`/`@expo/router-server` (both
  hoisted to the workspace root), so npm never hoisted `expo-router` itself —
  it stayed nested under `mobile/node_modules`. Those packages' runtime code
  does a plain `require('expo-router/_ctx-shared')` resolved from their own
  (root) location, which `npx expo start`/`npx expo run:ios` could never
  satisfy, crashing with `MODULE_NOT_FOUND`. Fix: declare `expo-router` as a
  real root `devDependency` (same `~57.0.8` pin) so npm hoists one shared copy.
  Linked `mobile/app.json` to an EAS project (`eas init`, `penguinfactory`
  account) for the push-token `projectId` `notifications.ts` already reads.
  Discovered Expo Go's public build only supports SDK 54 (one behind this
  project's SDK 57), so device validation used a local **iOS Simulator**
  instead (downloaded via `xcodebuild -downloadPlatform iOS`, no Apple
  Developer Program needed): `npx expo run:ios` — first run needed CocoaPods,
  installed via `brew install cocoapods` after the automated installer inside
  `expo run:ios` failed non-interactively. Full native build succeeded,
  installed, and launched on an iPhone 17 (iOS 26.5) simulator; screenshot
  confirmed the real login screen (🐰🐧 mark, Google/Apple buttons, local
  test sign-in). **User signed in with the local test account and confirmed
  navigating the five-tab shell** — this is the acceptance evidence for Task 7.
  Physical-iPhone testing (Expo Go is not usable at SDK 57) is deferred to an
  EAS dev-client or TestFlight build, gated on the user's in-progress Apple
  Developer Program enrollment — tracked in memory, not blocking Task 8.

**Known caveat carried forward:** the on-disk React duplicate (19.2.3 vs 19.2.7)
is a monorepo artifact of the accepted web app's React pin. It is mitigated for
the native bundle by the Metro single-React resolver and for tests by the jest
`moduleNameMapper`. A permanent fix (aligning both packages on one React) is a
cross-cutting change to the accepted web checkpoint and was deliberately not
made under Task 7; revisit during Task 9 dependency hardening.

**Task 7 is accepted.** See the Task 8 section below for the active work.

## Task 8 — Expo feature parity and visual implementation (in progress)

Scope (from the plan): implement the same five tabs, header actions, detail
stacks, modal/bottom-sheet flows, design tokens, validation, optimistic
behavior, and server operations as web. Use Heroicons, React Native SVG, and
TenTap. Implement Calendar, Groceries, Ledger/Assets, multiple Notes,
Trips/Expenses, notification inbox, and Settings at phone portrait sizes.
Validate against the supplied references on iPhone and Android development
builds and add focused component tests.

Reference material to build against:

- `docs/mobile-design-reference/README.md` + `Household Hub Mobile.dc.html` —
  the target visual system and interaction patterns for every screen.
- Web feature implementations (`src/features/calendar|groceries|ledger|notes|
  trips|settings/`) — the read/mutation contracts to mirror exactly (same
  `enqueueOperation` command types, same domain validators). Native screens
  are a new UI layer over the *same* server contract, not a reinterpretation.
- `mobile/src/lib/operations/` (queue, overlay, realtime), `mobile/src/lib/
  supabase.ts`, `mobile/src/lib/auth/` — already built in Task 7, ready to use.
- `mobile/src/theme/tokens.ts` — light/dark tokens exist but are minimal;
  expect to expand them to match the design reference's full palette/spacing.

Device validation (iOS Simulator, `npx expo run:ios`) is available now — see
Task 7F above for the working setup (CocoaPods via Homebrew, EAS project
linked). A native rebuild (not just a JS reload) is required whenever a new
native module is installed (e.g. this checkpoint added react-native-svg,
@react-native-community/datetimepicker, @react-native-picker/picker).

Sub-checkpoints:

- **8A — Design tokens, shared UI primitives, Calendar tab (done, `6e0224a`).**
  `theme/tokens.ts` expanded to the full palette from `src/styles/theme.css`
  (data colors, card/control radii, shadows, muted-text tiers) — ported values,
  not reinterpreted. Shared native UI in `mobile/src/components/`: `icons.tsx`
  (Heroicons via react-native-svg, using the exact path data the web client's
  `@heroicons/react` package ships and the design HTML embeds — the web
  package itself only exports DOM components, so this is the RN-appropriate
  equivalent), `AppHeader` (floating circular bell/gear buttons, no title —
  matches the design reference exactly; each screen renders its own big page
  title in-content instead), `FloatingTabBar` (a custom `Slot`-based
  `(tabs)/_layout.tsx`, **not** expo-router's native `<Tabs>` bar — the design's
  floating pill + accent-soft active chip doesn't map onto the native tab bar's
  header/label conventions, and `@react-navigation/bottom-tabs` isn't even
  resolvable as a direct dependency in this SDK), `Card`, `SegmentedControl`,
  `states` (Loading/Empty/Error), `BottomSheet`, `ConfirmDialog`,
  `DateTimeField` (native date/time picker wrapper).
  Calendar tab (`app/(tabs)/index.tsx` + `src/features/calendar/`): the pure
  logic (`monthGrid.ts`, `events.ts`, `datetime.ts`, `reminders.ts`,
  `mutations.ts`) is copied **verbatim** from web — platform-agnostic by
  design, and their Vitest tests port to Jest unchanged (31 tests, identical
  assertions). Added a native `useCalendarEvents` hook and `EventSheet` (title,
  all-day switch, native date/time pickers, recurrence chips, reminder chips,
  owner chips, note, delete-confirm) against the same `calendar.event.upsert`/
  `delete` operation contract as web. Copied the web-generated
  `src/types/database.ts` into `mobile/src/types/` (one shared Supabase
  backend — same pattern as duplicating the operations layer in Task 7) and
  wired `supabase.ts`/`queue.ts` to the typed client.
  **Verification:** 68 mobile tests / 13 suites pass, `tsc --noEmit` clean.
  **Real-device evidence:** rebuilt and ran on the iOS Simulator (iPhone 17,
  iOS 26.5) after installing the three new native modules (CocoaPods rebuild
  required); screenshotted in both light and dark appearance — header, legend
  (Yongju filled dot / Claire outlined dot / Shared accent dot), month grid
  with a live seeded event dot on the correct day, selected-day empty state,
  and the floating tab bar's active-chip treatment all match the design
  reference. EventSheet's interactive open/save/delete flow was not tap-tested
  on device this checkpoint (no reliable synthetic-tap tooling in this
  environment — AppleScript `System Events` clicks land on the real desktop,
  not the Simulator, and were abandoned after one stray click); it is covered
  by the same pure-logic tests as web plus manual verification is expected
  from the user.

- **8B — Groceries tab (done, `e842444`).** Converted `groceries.tsx` to a
  folder route (`index` + `[listId]`). Ported web's pure logic verbatim
  (`sortGroceryItems`, `cheapestPriceHistory`, `groceryNameSuggestions`,
  `normalizeItemName`, `latestPriceByName`, `moneyInput`'s
  `parseDollarsToCents`/`centsToInputValue`). List index + detail (add-item
  row with CAD price, household-wide name autocomplete, last-price recall,
  unchecked/checked sections, five-cheapest price-history card, per-item edit,
  inline rename via new `EditableTitle`, clear-checked/delete-list confirms)
  against the same `grocery.list.*`/`grocery.item.*` contract as web.
  `FloatingTabBar` active-matching now prefix-matches non-root paths so a
  detail route keeps its tab highlighted. **Verification:** 80 tests / 15
  suites, tsc clean. Visual: confirmed clean app boot only — `simctl` in this
  Xcode has no synthetic-tap capability, and `simctl openurl` for a
  `/groceries` deep link hits an untappable iOS "Open in App?" system dialog,
  so interactive tap-through to nested routes isn't currently automatable in
  this environment.
- **8C — Ledger tab, Statements + Assets (done, `72615f3`).** Converted
  `ledger.tsx` to a folder route. Ported all pure Ledger logic and mutation
  builders verbatim (`statements.ts`, `statementMutations.ts`, `assets.ts`,
  `assetMutations.ts`). `LedgerScreen` (Statements/Assets `SegmentedControl`),
  `StatementsTab` (year list, inline-expand summary, new-year sheet),
  `[yearId]` month detail (4×3 month grid, `StatementCharts` with income/
  spending breakdown + monthly-limit bars, Spent/Limit/Left cards, category
  progress bars, Income/Spending transaction lists, typed-year clear),
  `AssetsTab` (CAD total + foreign subtotals never converted, assets,
  one-off + recurring transfers). New shared `DonutChart` (react-native-svg
  stroke-dasharray — recharts is DOM-only) and `SelectField` (native
  wheel-picker wrapping `@react-native-picker/picker`, RN's `<select>`
  equivalent). **Verification:** 91 tests / 17 suites, tsc clean; a full
  production `expo export` (1458 modules, up from 1283 at Task 7E) confirmed
  every route — including the ones blocked from interactive tap-through —
  bundles without resolution errors.

- **8D — Notes tab, TenTap port (done, `5619825`).** Converted `notes.tsx` to
  a folder route. Ported web's `data.ts`/`mutations.ts` verbatim.
  `RestrictedEditor.tsx` assembles TenTap's bridge extensions individually
  (Core/History/Heading-levels-1-3/BulletList/OrderedList/ListItem/TaskList/
  HardBreak/Placeholder) instead of the full `TenTapStartKit`, which also
  ships bold/italic/strike/code/link/color/highlight/image/blockquote/
  underline/dropcursor — none permitted by the shared `isRichNoteJson`
  domain validator. This mirrors exactly how web restricts `StarterKit`.
  TenTap runs Tiptap inside a WebView (new native dep: `react-native-webview`)
  and exposes content async via `editor.getJSON()`; a custom toolbar (Body/
  H1-H3/bullet/numbered/checklist/undo/redo) matches web's one-for-one, reading
  active state from `useBridgeState`. `RestrictedNoteView.tsx` is a native
  read-mode renderer for the same restricted node set. `[noteId]`: plain read
  view with explicit Edit/Save/Cancel drafting (one title+document draft,
  matching web's queued-save/local-accepted-snapshot pattern).
  **Verification:** tsc clean; 91 tests still pass (no new pure logic beyond
  what `packages/domain/src/notes.test.ts` already covers). Native rebuild
  required (webview/tentap-editor ship native code); clean on-device boot,
  plus a full production `expo export` (1732 modules, up from 1458 at 8C, zero
  errors) — this eagerly bundles TenTap's WebView editor HTML/assets, which
  dev Metro's lazy route loading would not otherwise exercise.

- **8E — Trips tab (done, `55c7091`).** Converted `trips.tsx` to a folder
  route. Ported `data.ts`/`mutations.ts`/`forms.ts` verbatim. `TripsScreen`:
  list + create sheet. `[tripId]`: header card with inline `EditableTitle`
  rename, Itinerary/Bookings/Checklist/Expenses `SegmentedControl`
  (Itinerary/Bookings/Checklist show an honest "coming soon" — the
  mobile-first schema only defines `trip.*`/`trip.expense.*` operations,
  matching web's same scope note), and a fully functional Expenses tab
  (per-currency totals never converted/combined, expense list, `ExpenseSheet`
  with destination-or-CAD currency choice and a Paid-from Asset picker
  filtered to matching currency, deep-linking to Ledger/Assets when none
  exists). **Verification:** 93 tests / 18 suites, tsc clean; no new native
  modules, verified via clean JS-reload boot + production `expo export`
  (1738 modules, up from 1732 at 8D, zero errors).

Next: 8F (Settings + Notifications), then 8G final verification.

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
