# Household Hub Mobile-First Implementation Progress

**Last updated:** 2026-07-25

**Canonical continuation file:** `progress.md`

**Implementation branch:** `codex/household-hub-mobile-first`

**Implementation worktree:** `/Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first`
**Current HEAD:** `eafdce8 feat: Settings + legacy-free rebuilt routes (Task 6F)`
**Last review-clean baseline:** `d1f3e30` (Tasks 1–2, independent review).
Tasks 3, 4, and 5 are complete (self-reviewed). **Task 6 is complete**
(6A–6F done). **Task 7 (Expo foundation) is next** — a new phase; see
`mobile/AGENTS.md` before touching Expo code.

This file is the source of truth for continuing the approved web-first
Household Hub rebuild. Current Git state and fresh verification results take
precedence if this file ever becomes stale.

## How to resume safely

1. Work from:

   ```bash
   cd /Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first
   ```

2. Read, in order:

   - `progress.md`
   - `docs/superpowers/plans/2026-07-24-household-hub-web-first-native-parity.md`
   - `docs/superpowers/specs/2026-07-24-web-first-household-hub-redesign.md`
   - `docs/mobile-design-reference/README.md` (+ `Household Hub Mobile.dc.html`) — drives Task 5+ UI
   - `CLAUDE.md`
   - `docs/superpowers/progress-detail.md` — deep per-task history (optional)
   - `mobile/AGENTS.md` before changing Expo code

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

5. Resume at **Task 6 (web feature flows)**. Tasks 1–5 are complete,
   committed, and verified — do not redo them. Task 6 fills the placeholder
   screens (`src/shell/PlaceholderScreen.tsx` routes in `src/App.tsx`) with
   real feature flows and retires the unrouted legacy page screens.

6. **Task 7 (Expo foundation and offline data layer) is next** — a new phase.
   Task 6 (web feature flows) is complete: 6A–6F done and committed. Read
   `mobile/AGENTS.md` before changing Expo code. Update `progress.md` at
   **every sub-checkpoint** (HEAD, commit, verification, resume point) — per
   the user's directive.

   **Deferred cleanup (safe, no behavior impact):** the legacy page-based
   screens/hooks/components (`src/components/pages|budget|savings|groceries|
   trips|notes`, `src/hooks/useBudget|useSavings|usePages|useTrip|useGroceries|
   useCalendar`, `src/routes/PageView|SectionListPage`, and their tests) remain
   in the tree but are **fully unrouted and unreferenced by the rebuilt route
   graph** (verified by grep from `App.tsx` through `features/`, `shell/`,
   `components/auth/`). The functional retirement requirement — rebuilt clients
   never read/write legacy `pages`/`budget_*`/`savings_*` — is met. Physically
   deleting that dead code (~15 files + tests) was deferred to avoid
   destabilizing the passing suite at the end of Task 6; do it as its own
   commit before merge or during Task 9 cleanup.

## Approved product direction

- Rebuild and validate the web application first.
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
| 3. Identity, notifications, jobs, deployment config | Complete | Verified at `24a5b39` (self-review; no independent review agent) |
| 4. Durable web operation queue | Complete | Verified at `f86f4c0`; its UI surface lands with Task 5 |
| 5. Responsive web shell and visual system | Complete | Verified at `626c681` (self-review) |
| 6. Web feature flows | Complete | 6A–6F done; verified at `eafdce8` (self-review) |
| 7. Expo foundation and offline data layer | Pending | Not started |
| 8. Expo feature parity and visual implementation | Pending | Not started |
| 9. Reset procedure, E2E verification, release handoff | Pending | Not started |


## Task 6 — web feature flows (complete)

Fills the placeholder routes with real, tested flows on top of the durable
operation queue (Task 4) and shell (Task 5). Sub-checkpoints (each TDD →
implement → affected suite → commit → this file):

- **6A — Calendar (done).** `src/features/calendar/`: pure `monthGrid.ts`
  (6×7 Sunday-first grid, span/shift helpers) and `events.ts` (recurrence +
  multiday expansion, device-timezone placement via the domain's
  `calendarDateInTimeZone`); `datetime.ts` wall-clock↔UTC for the event
  timezone; `useCalendarEvents` (household-scoped read, reminders joined);
  `mutations.ts` (`calendar.event.upsert`/`delete` payload builder + enqueue);
  `EventSheet` (timed/all-day/multiday, recurrence, reminder presets, owner,
  delete-confirm) and `CalendarScreen` (month grid with event dots,
  selected-day list, `?event=<id>` notification deep link). Route wired in
  `src/App.tsx`. `src/features/household.ts` shared household accessor.
  **Verification:** `npx vitest run` **308 passed** (48 files; +29 vs Task 5),
  lint clean, build clean.
- **6B — Groceries (done).** `src/features/groceries/`: `data.ts` (list index
  + list detail reads with price history joined; `latestPriceByName`,
  `normalizeItemName`); `mutations.ts` (list/item upsert+delete, toggle-checked,
  clear-checked = one delete command per checked item); `GroceriesScreen`
  (list index + create-list sheet), `GroceryListScreen` (add-item row with CAD
  price, unchecked/checked split, per-item edit `ItemSheet`, price recall from
  history, clear-checked + delete-list confirms), routes `/groceries` and
  `/groceries/:listId`. Shared `src/features/moneyInput.ts`
  (`parseDollarsToCents`/`centsToInputValue`, integer-cents boundary, reused by
  Ledger/Trips). **Verification:** `npx vitest run` **324 passed** (51 files;
  +16), lint clean, build clean.
- **6C-1 — Ledger Assets segment (done).** `src/features/ledger/`: `assets.ts`
  (reads from the `ledger_asset_balances` view; transfers + schedules reads;
  `totalsByCurrency`/`householdTotalCents` — CAD is the household total, foreign
  currencies shown separately and never converted); `assetMutations.ts`
  (asset/transfer/schedule upsert+delete, `toggleSchedule`, balance is the
  *desired* balance the server reconciles); `AssetSheet` (name/kind/currency/
  balance; currency locked once the asset exists), `TransferSheet` +
  `ScheduleSheet` (weekly/biweekly/semi_monthly/monthly), `AssetsTab` (total
  header + foreign subtotals, asset cards, transfers, recurring with
  active-toggle + delete confirms). `LedgerScreen` shell with Statements/Assets
  `SegmentedControl`; route `/ledger`. `StatementsTab` is a temporary
  placeholder until 6C-2. **Verification:** `npx vitest run` **330 passed**
  (53 files; +6), lint clean, build clean.
- **6C-2 — Ledger Statements segment (done, committed `2ebd49b`).**
  `src/features/ledger/statements.ts` (`useLedgerYears`/`useLedgerYearData`
  reads across months/month-categories/limits/transactions; `monthSummaries`
  income/spending/net per month; `categoryProgress` spend-vs-limit ratio per
  category; `hasSpendingFromMonth` deletion-guard helper); `statementMutations.ts`
  (`createYear`/`clearYear`/`saveCategory`/`deleteCategory`/`saveLimit`/
  `saveTransaction`/`deleteTransaction`, matching the RPC's `ledger.year.*`/
  `ledger.category.*`/`ledger.limit.*`/`ledger.transaction.*` command types in
  `supabase/migrations/20260725011000_household_operation_rpc.sql`);
  `TransactionSheet`, `CategorySheet` (name/kind/limit, fromMonth→December
  propagation), `ClearYearSheet` (typed-year confirmation); `StatementsTab`
  replaces the 6C-1 placeholder with year picker + create-year, 4×3 month
  picker with per-month net, category list with limit progress bars, and
  clear-year. **Verification:** `npx vitest run` **334 passed** (54 files;
  +4), lint clean, build clean. Not independently reviewed (session
  directive: no subagents).
- **6D — Notes (done, committed `787eca3`).** `src/features/notes/`:
  `data.ts` (`useNotes` list, `useNote` detail reads against
  `household_notes`; `emptyNoteDocument`); `mutations.ts` (`saveNote`/
  `deleteNote` via `note.upsert`/`note.delete`, matching the RPC's
  `mobile_note_node_valid` payload shape); `RestrictedEditor.tsx` — Tiptap
  restricted to StarterKit with bold/italic/strike/code/codeBlock/blockquote/
  horizontalRule/link/underline/dropcursor/gapcursor disabled, heading levels
  capped to 1-3, plus `TaskList`/`TaskItem`, so every producible document
  satisfies the shared `isRichNoteJson` validator (`packages/domain/src/
  notes.ts`) that native TenTap must also satisfy; own `editor.css` using
  `--hh-*` tokens (kept separate from the legacy `src/components/notes/
  editor.css`, which still styles the unrestricted legacy Tiptap editor).
  `NotesScreen` (list + create), `NoteScreen` (title input saved on blur,
  document saved via the editor's debounced `onChange`, delete-confirm) at
  routes `/notes` and `/notes/:noteId`, replacing the Task 5 placeholder.
  Title and document edits share one locally-tracked revision (advanced by
  one per successful save, matching the RPC's `current_revision + 1`) so a
  title edit and a document edit moments apart each get a fresh base
  revision without waiting on a refetch. **Verification:** `npx vitest run`
  **342 passed** (57 files; +8), lint clean, build clean. Not independently
  reviewed (session directive: no subagents); manual browser check limited to
  confirming the route renders with no console/build errors — the worktree's
  `VITE_DISABLE_AUTH` bypass (see Environment section) means there is no
  Supabase session locally, so real household data CRUD wasn't exercised
  end-to-end in a browser.
- **6E — Trips (done).** `src/features/trips/`: `data.ts` (`useTrips` list,
  `useTrip` detail with expenses; `expenseBuckets` delegates to the domain's
  `aggregateTripCurrencyBuckets` — CAD and destination-currency totals stay
  separate and are never converted); `mutations.ts` (`saveTrip`/`deleteTrip`
  via `trip.upsert`/`trip.delete`; `saveExpense`/`deleteExpense` via
  `trip.expense.upsert`/`trip.expense.delete` — a CAD expense is server-linked
  into the Ledger + debits the asset, a foreign expense debits only);
  `TripSheet` (name/destination/dates/timezone/currency), `ExpenseSheet`
  (amount/currency choice of destination or CAD/asset/date), `TripsScreen`
  (list + create) and `TripScreen` (header + Itinerary/Bookings/Checklist/
  Expenses tab bar; **Expenses fully functional** with per-currency buckets).
  Routes `/trips` and `/trips/:tripId`. **Scope note:** the mobile-first schema
  (Task 2) only defines `household_trips` + `trip_expenses` and the RPC only
  supports `trip.*`/`trip.expense.*` — the Itinerary/Bookings/Checklist tables
  are legacy page-based (`page_id`, no mobile-first operations), so those three
  tabs render an honest "coming soon" state. Wiring them needs new mobile-first
  content tables + operations (a schema follow-up, not part of the current
  durable-queue contract). **Verification:** `npx vitest run` **348 passed**
  (59 files; +6), lint clean, build clean. Not independently reviewed (session
  directive: no subagents).
- **6F — Settings + legacy retirement (done).** `src/features/settings/`:
  `profile.ts` (`useProfile` reads the signed-in user's `profiles` row;
  `saveProfileSettings` persists displayName/appearance/notificationsEnabled via
  the `settings.update` durable operation, entityId = user id per the RPC's
  `entity_id = actor_id` rule); `household.ts` (`useHouseholdMembers` with roles
  + `owner_user_id`, `useHouseholdInvites` pending list; admin RPC wrappers
  `createInvite`/`revokeInvite`/`transferOwnership`/`removeMember`/
  `deleteHousehold`/`prepareAccountDeletion`, each normalized to the domain's
  `HouseholdAdminResult`); `DangerConfirm` (typed-phrase destructive gate);
  `SettingsScreen` replaces the Task-5 `src/screens/SettingsScreen.tsx`
  (removed) with Profile (name + notifications), Appearance (local + synced via
  settings.update), Household (members/roles, invite create+revoke shown only
  when there's no partner, transfer-ownership + remove-member shown to the owner
  with a partner), Account (email + sign out), and a Danger zone (delete
  household / delete account, both typed-confirmed). Route rewired in
  `src/App.tsx`. **Legacy retirement:** the rebuilt route graph (App → features/
  shell/ components/auth) is verified free of legacy `pages`/`budget_*`/
  `savings_*`/page-template hook imports; the dead legacy code physically
  remains in-tree (unrouted, unreferenced) with deletion deferred as a safe
  standalone cleanup (see "How to resume safely" §6). **Verification:**
  `npx vitest run` **353 passed** (60 files; +5), lint clean, build clean. Not
  independently reviewed (session directive: no subagents). **Task 6 complete;
  next is Task 7 (Expo).**

## Task 5 — responsive web shell + visual system (complete)

Built beside the legacy Swiss theme; legacy page screens stay **unrouted** in
the tree until Task 6 retires them. Sub-checkpoints (each committed + verified):

- **d452fa3** — `src/styles/theme.css` semantic `--hh-*` tokens (design
  reference: canvas `#EFEFF2`, ink `#14151A`, accent `#FF7A45`, data palette,
  card radii/shadows) + light/system-dark/forced-dark; `src/lib/appearance.ts`
  Light/Dark/System (`data-appearance` on `<html>`, persisted, applied on boot).
- **37b60dc** — `src/shell/AppShell.tsx`: persistent header (rabbit/penguin
  mark + Notifications/Settings header icons), phone floating 5-tab bar,
  desktop left pane; Heroicons. Routes `/calendar` (default; `/` and unknown →
  redirect), `/groceries`, `/ledger`, `/notes`, `/trips`, `/notifications`,
  `/settings`. Placeholder screens; Settings is real (appearance/account/sign
  out).
- **626c681** — `src/shell/ui/`: `Card`, `SegmentedControl`, `BottomSheet`,
  destructive `ConfirmDialog` (Radix), `Loading/Empty/Error` states, and
  `SyncStatus` (surfaces the Task 4 queue: pending pill + per-discard conflict
  cards via `explainDiscard`).

**Verification at `626c681`** (arm64 node): `npx vitest run` 44 files /
**279 passed**; `npm run lint` clean; `npm run build` clean. Responsive is via
Tailwind `md:` breakpoints; visual/responsive **screenshot** tests are deferred
to Task 9's Playwright setup (per the plan). Not independently reviewed
(session directive: no subagents); `/code-review` remains the pre-merge
follow-up.

## Environment, constraints & risks (condensed)

- **Local sign-in is temporarily bypassed** (user request, re-enable later):
  `VITE_DISABLE_AUTH=true` in `.env.local` makes `RequireAuth` skip the login
  gate in dev (never in production or tests). This renders the shell with **no
  Supabase session**, so household data won't load until sign-in is re-enabled
  (remove the flag) or a dev auto-login is added. Committed at `2cf1d88`.
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
- **No independent review agent ran for Tasks 3–4** (session directive: no
  subagents) — self-review + live end-to-end only. `/code-review` on this branch
  is the recommended pre-merge follow-up.
- **Legacy membership preflight:** the one-user/one-household unique constraint
  fails if legacy data has a user in multiple households — resolve before a
  hosted deploy.
- Carried-forward risks (permanently-failing push batch, Expo push not yet
  exercised against Expo's servers, live two-client Realtime) are in the archive.

## Full detail

Architecture diagrams, per-task narratives, per-task verification baselines,
reviews, and the original task scope now live in
`docs/superpowers/progress-detail.md`. Current git state + fresh verification
always take precedence over both files.
