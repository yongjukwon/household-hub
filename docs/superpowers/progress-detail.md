# Household Hub Mobile-First — Implementation Detail (archive)

Full per-task narratives, architecture diagrams, verification baselines, and
reviews for Tasks 1-4, plus the original task scope. The concise resume state
lives in `progress.md`; this file is the deep record, not required to continue.

---

## 2026-07-25 web parity correction acceptance

The correction pass is complete across Calendar, Groceries, Ledger, Notes, and
Trips. It closes the user-reported workflow gaps without changing the shared
server-authoritative architecture.

```mermaid
flowchart LR
    UI["Reference-aligned web UI<br/>phone tabs + desktop pane"]
    Queue["Durable command queue<br/>optimistic local overlay"]
    RPC["apply_household_operation<br/>validation + household serialization"]
    DB["Supabase domain tables<br/>revisions + receipts + change log"]
    Partner["Partner browser<br/>Realtime invalidation"]

    UI --> Queue
    Queue --> RPC
    RPC --> DB
    DB --> Partner
    DB --> UI
```

### Accepted feature behavior

| Area | Accepted result |
| --- | --- |
| Calendar | Timed/all-day payload branches, reminder adapter, and final rejection handling work through the real RPC |
| Groceries | Inline list rename, household autocomplete, purchase dates, checked-newest-first ordering, and five cheapest historical prices |
| Ledger | List-first years, annual and monthly charts, 12-month details, default income categories, separate income/spending flows, and atomic Asset postings |
| Notes | Semantic read mode; one explicit title-and-document draft with Save/Cancel; restricted shared JSON |
| Trips | Manual ISO destination currency, matching-Asset selection, separate CAD/foreign totals, and CAD-only Travel Ledger linkage |

The correction commits are:

- `b7a33b7 fix: align Calendar operation contract`
- `876d532 feat: restore Grocery parity workflows`
- `9523b77 feat: complete Ledger statement workflows`
- `bfd8d5d feat: add Notes read and explicit edit modes`
- `2b18d9e feat: clarify Trip currency expense flow`
- `docs: complete web parity correction handoff` (final acceptance commit)

### Database changes and live evidence

- `20260725016000_grocery_purchase_dates.sql` adds server-owned Grocery
  `checked_at` lifecycle behavior.
- `20260725017000_ledger_default_income_categories.sql` creates and backfills
  Salary, Bonus, RRSP, TFSA, ESPP, and Government benefit for all 12 months.
- A loopback-only reset replayed the full migration chain. Database verification
  passed **313 tests across 5 files**, and Supabase lint reported no schema
  errors.
- The two-member `🐰 & 🐧 Test` household was recreated through onboarding and
  invite redemption, then populated with **26 real operation RPC commands**.
- The retained dataset exposes every corrected screen: Calendar event, two
  Grocery lists and price history, CAD/GBP Assets, 2026 Ledger activity,
  auto-linked 2027 Travel spending, a checklist Note, and London Trip totals of
  CAD `$5,309.00` plus GBP `£2,409.00`.

Local test credentials:

| Member | Email | Password | Role |
| --- | --- | --- | --- |
| Yongju | `yongju@test.local` | `household123` | Owner |
| Claire | `claire@test.local` | `household123` | Member |

### Browser and regression evidence

- Authenticated system-Chrome review at **402×874** and **1440×1000** covered
  Calendar, Grocery list/detail, Ledger annual/month detail, Notes read view,
  and Trip detail.
- 24 screenshots are retained outside Git under
  `/tmp/household-hub-web-parity/`; no generated artifact was added to the
  repository.
- The review found zero page errors and zero console errors.
- Recharts animation was disabled for statement donuts to make initial paint
  complete and deterministic.
- Final web suite: **70 files, 398 tests passed**; ESLint, TypeScript,
  production Vite/PWA build, and `git diff --check` passed.
- Edge Function tests: **73 passed**.
- Queue tests cover offline and reconnect replay, duplicates, stale conflicts,
  permanent discard explanations, two-device ordering, local overlays, and
  Realtime reconciliation.

### Explicit residuals and resume gate

- The existing production-build large-chunk warning is accepted and
  non-blocking.
- Trip Itinerary, Bookings, and Checklist require new mobile-first tables and
  operation types. Those tabs retain an explicit coming-soon state; Expenses is
  complete.
- No hosted environment was changed, no production reset was run, and no
  native/physical-device verification is claimed.
- Task 7 (Expo foundation) is the next task, but must not begin until the user
  accepts this web checkpoint.

---

## Architecture after Tasks 1 and 2

```mermaid
flowchart TD
    Web["Web app<br/>Vite + React"]
    Native["Native app<br/>Expo SDK 57"]
    Domain["@household-hub/domain<br/>validation, money, dates, notes,<br/>query keys, operation contracts"]
    WebQueue["Web durable queue<br/>Task 4"]
    NativeQueue["Native durable queue<br/>Task 7"]
    RPC["apply_household_operation(command)"]
    Gate["Authentication + membership<br/>household transaction lock"]
    Sync["Receipts · revisions · tombstones<br/>change log · Realtime"]
    Identity["Household identity<br/>profiles · members · invites · settings"]
    Finance["Finance<br/>Assets · postings · transfers<br/>Statements · months · categories · limits"]
    Features["Shared features<br/>Calendar · Groceries · Notes · Trips"]
    Legacy["Legacy page-based tables<br/>retained temporarily"]

    Web --> Domain
    Native --> Domain
    Domain --> WebQueue
    Domain --> NativeQueue
    WebQueue --> RPC
    NativeQueue --> RPC
    RPC --> Gate
    Gate --> Sync
    Gate --> Identity
    Gate --> Finance
    Gate --> Features
    Legacy -. "not migrated or used by rebuilt clients" .-> Features
```

### Authoritative operation lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant Queue as Durable client queue
    participant RPC as apply_household_operation
    participant Guard as Household lock and validation
    participant DB as Domain tables and postings

    Client->>Queue: Store optimistic command
    Queue->>RPC: Replay by local sequence
    RPC->>Guard: Authenticate, authorize, lock household
    Guard->>Guard: Check command hash, receipt, revision, tombstone
    alt Valid first operation
        Guard->>DB: Apply rows, postings, revision and change record atomically
        DB-->>RPC: Applied result and warnings
    else Same operation and same content
        Guard-->>RPC: Duplicate result
    else Stale revision
        Guard-->>RPC: Conflict plus winning action
    else Invalid business action
        Guard-->>RPC: Rejected plus code, reason and details
    end
    RPC-->>Queue: Persist outcome
```

## Task 1 — Shared foundation and domain contracts

### Delivered

Created the internal pure-TypeScript package:

```text
packages/domain/
├── src/calendar.ts
├── src/money.ts
├── src/notes.ts
├── src/operations.ts
├── src/queryKeys.ts
├── src/trips.ts
├── src/validation.ts
└── src/index.ts
```

It is consumed by both the root Vite application and the Expo package.
TypeScript, Vite, npm workspace, and Metro resolution were updated without
placing React UI in the shared package.

### Shared validation

- UUID identifiers
- Safe integer cents, including signed and positive schemas
- Explicit ISO 4217 currency validation
- IANA timezone validation
- Strict ISO dates and datetimes, including rejection of normalized impossible
  dates such as February 30
- Mutable revisions beginning at 1
- Local sequence and operation-envelope validation

### Money, Calendar, and Trips

- Currency-aware cents formatting
- No currency conversion
- Timed Calendar events use UTC instants and a source timezone
- All-day Calendar events preserve fixed dates
- Trip totals aggregate into separate currency buckets

### Notes contract

The shared rich-note JSON validator accepts only:

- document
- paragraph
- text
- hard break
- Heading 1–3
- bullet list
- numbered list
- checklist
- list item
- checklist item with a Boolean checked value

Images, links, unsupported marks, arbitrary attributes, and invalid nested
content are rejected.

### Durable operation contract

Commands include:

- schema version
- operation ID
- device ID
- local sequence
- household ID
- allowlisted operation type
- entity type and entity ID
- base revision
- enqueue timestamp
- strict payload

Results form a discriminated union:

- `applied`: server sequence, resulting revision, optional details/warnings
- `duplicate`: original server sequence
- `conflict`: current revision and winning operation/entity details
- `rejected`: stable code, reason, structured details, and warnings

### Task 1 commits

- `d49035d feat: add shared domain contracts`
- `ffc3c01 fix: tighten domain contract validation`

### Task 1 review

The first review found seven important gaps:

1. The Expo package depended on untracked entry/config files.
2. Required Ledger/transfer/schedule operation families were absent.
3. Conflict results did not require winner details.
4. Currency validation accepted non-ISO three-letter strings.
5. Calendar accepted impossible normalized dates.
6. Notes accepted invalid fields on node types.
7. The Notes document type disagreed with runtime validation.

All seven were fixed. The scoped re-review approved Task 1 with no new
Critical or Important issues.

## Task 2 — Mobile-first Supabase schema and authoritative RPC

### Ordered migrations

- `supabase/migrations/20260725010000_mobile_first_schema.sql`
- `supabase/migrations/20260725011000_household_operation_rpc.sql`
- `supabase/migrations/20260725012000_mobile_first_security_realtime.sql`

These migrations retain the legacy page-based schema but add the mobile-first
model beside it.

### Identity and household schema

- Existing households now carry an owner.
- Profiles store global display identity.
- Household members are restricted to one active household per auth user.
- Household invites store only token hashes and support expiry, revocation,
  and redemption state.
- Household user settings store appearance and notification preferences.
- The maximum-two-member behavior is supported for the onboarding/admin
  operations implemented in Task 3.

### Assets

- `ledger_assets`
- immutable `asset_postings`
- `ledger_transfers`
- `ledger_transfer_schedules`
- idempotent schedule occurrences
- a security-invoker balance view derived from postings

Asset balances are not maintained as independently mutable totals. Income,
spending, transfers, and Trip expenses produce immutable posting effects.

### Ledger

- Statement years
- exactly twelve month rows per created year
- stable category identities
- month-specific category configuration
- nullable monthly spending limits
- income and spending transactions
- default income category support
- unbudgeted Travel category support

Category and limit changes propagate from the selected month through December.
Earlier months remain unchanged.

Category deletion is rejected when spending exists in the selected or any
later affected month. The structured rejection identifies blocking months.

### Calendar

The existing Calendar table is extended rather than replaced:

- UTC timed boundaries
- IANA event timezone
- date-fixed all-day boundaries
- revision values
- multiple reminder presets

Existing Calendar rows are backfilled into the entity-revision registry so
they can immediately participate in queued mutation conflict handling.

### Groceries, Notes, Trips, and Notifications

- Standalone grocery lists, items, and immutable price history
- Multiple named Notes with restricted JSON documents
- Standalone Trips with destination timezone
- Itinerary, bookings, checklist, and expenses
- Notification inbox records and device-facing metadata

### Operation infrastructure

- per-household server sequence state
- idempotent operation receipts
- entity revision registry
- tombstones
- household change log
- safe Realtime publication metadata

### `apply_household_operation`

The security-definer RPC:

1. Validates authentication and household membership.
2. Locks the household row to serialize operations.
3. Rechecks and locks membership under the household lock.
4. Rejects oversized, malformed, or extra-key payloads.
5. Uses a fixed allowlisted dispatch; no dynamic SQL.
6. Hashes canonical command content.
7. Returns `duplicate` for an identical operation replay.
8. Rejects operation-ID reuse with different content.
9. Checks base revision and tombstone state.
10. Applies domain rows, financial postings, revision, receipt, and change log
    atomically.
11. Returns structured negative-balance warnings.

### Financial invariants

- Ledger income uses a positive Asset posting.
- Ledger spending uses a negative Asset posting.
- Edits append reversals/deltas rather than rewriting posting history.
- Deletes reverse their financial effect.
- Negative balances are allowed but reported.
- Transfers require distinct Assets in the same currency.
- Transfer edits/deletes warn about any source, new destination, or old
  destination driven below zero.
- Asset currency cannot change while referenced by a posting, transaction,
  transfer, schedule, or Trip expense.
- Recurring transfers have no income/spending effect.

### Trip expense behavior

CAD expense:

- creates the Statement year and all twelve months when absent
- creates or repairs the system Travel category
- leaves Travel unbudgeted when no explicit limit exists
- creates one linked Ledger spending transaction
- uses that Ledger posting as the Asset debit, avoiding double debit

Foreign expense:

- requires an Asset matching the Trip destination currency
- creates one foreign Asset debit
- creates no CAD Ledger transaction
- performs no conversion

Trip totals therefore remain separate, for example:

```text
CAD $5,309
GBP £2,409
```

### Typed-year clear

`ledger.year.clear` requires the exact year confirmation and removes only the
selected Statement year’s Ledger data.

When CAD Trip expenses are linked to that year:

- the Trip expenses remain
- their Ledger links are detached
- their Asset effects are converted to Trip-origin postings
- Asset balances remain accurate
- ordinary Ledger postings are reversed

### Revision and conflict integrity

Indirect parent operations also maintain child revision streams:

- deleting/editing Trip expenses tombstones generated Ledger children
- deleting a year advances or tombstones affected child entities
- partial category deletion advances category/limit child revisions
- Travel restoration preserves stable identities and invalidates stale queued
  operations
- limit identity cannot be replaced by a competing null-base operation

### Security

- Members can read only their household’s rows through RLS.
- New mutable tables deny direct authenticated writes.
- Existing `households` and `household_members` explicitly revoke
  `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE`.
- Helper functions revoke execution from `PUBLIC`, `anon`, and
  `authenticated`.
- Only the public operation RPC is granted to authenticated users.
- Security-definer functions use an explicit safe search path.
- Realtime publishes user-facing tables/change metadata, not private receipt
  or device command data.

### Task 2 commits

- `f732c1d feat: add mobile-first household schema`
- `5c3f5cd feat: add authoritative household operation RPC`
- `6d4a122 test: secure mobile-first database operations`
- `ad62d8e fix: close mobile operation security gaps`
- `d1f3e30 fix: harden mobile operation invariants`

### Task 2 review

The official review found eight Important issues:

1. Existing Calendar rows were outside the revision system.
2. Trip-generated Ledger children could be recreated by stale commands.
3. Asset/Trip currency changes could invalidate dependent records.
4. Transfer deletion could omit a negative-balance warning.
5. Partial Travel deletion could break later CAD Trip expenses.
6. Competing limit IDs could bypass revision conflicts.
7. Global profiles could receive multiple household revision streams.
8. Extended tenancy tables retained explicit DML grants.

The fix round added regression coverage and corrected all eight. Additional
review during the fix found and corrected:

- partial category/Travel repair child revision gaps
- stale category/limit operations after parent mutations
- transfer-edit warnings for the previous destination Asset
- real pre-migration Calendar upgrade behavior

The official scoped re-review marked every original finding addressed and
found no new Critical or Important breakage.

## Current verification baseline

Freshly verified at `d1f3e30`:

| Verification | Result |
| --- | --- |
| `supabase db reset --local` | Passed |
| Main operation pgTAP suite | 89/89 passed |
| Review regression pgTAP suite | 81/81 passed |
| Pre-migration Calendar upgrade harness | 81/81 passed, no skips |
| `supabase db lint --local --schema public --level warning --fail-on error` | No errors |
| `npm test -- --run` | 34 files, 216/216 passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `git diff --check ffc3c01..d1f3e30` | Passed |

Expected existing warnings:

- Supabase reports the old `[inbucket]` local config section as deprecated.
- Node prints the existing experimental `localStorage` warning during Vitest.
- Vite reports an existing main-bundle chunk larger than 500 kB.
- Dependency audits currently report existing package vulnerabilities; no
  broad dependency upgrade was performed in Tasks 1 or 2.

## Known constraints and release risks

1. **No remote changes:** all database verification used local Supabase. No
   production or hosted Supabase project was changed.
2. **No data reset:** the production clear procedure is Task 9 and requires
   explicit release-time approval.
3. **Migration deployment:** the three Task 2 migrations are new and have not
   been deployed remotely. If an environment somehow records an earlier
   intermediate version, create later corrective migrations instead of
   relying on edits to an applied migration.
4. **Legacy membership preflight:** the one-user/one-household unique
   constraint will deliberately fail if legacy data has a user in multiple
   households. Run a duplicate-membership query and resolve any rows before
   hosted deployment.
5. **Future household rejoin:** leaving/rejoining another household needs an
   explicit profile-revision reset or migration strategy.
6. **Concurrent-session test:** household locking is implemented and sequence
   behavior is tested, but a true two-simultaneous-session race test remains
   for Task 9.
7. **Live Realtime:** publication and replica-identity metadata are verified;
   live two-client websocket delivery remains for Task 9.

## Task 3 — In progress

Being executed in ordered sub-checkpoints (commit + verify after each) because
Task 3 is large; this keeps progress durable across sessions.

### Done: 3A domain contracts (`47f1763`)

Added the household-administration domain layer in `@household-hub/domain`:

- `packages/domain/src/households.ts` — `householdAdminActions` allowlist
  (`household.onboard`, `invite.create|revoke|redeem`, `ownership.transfer`,
  `member.remove`, `account.delete`, `household.delete`) with strict
  per-action payload validation (exact key set + per-field validators, extra
  keys rejected); `MAX_HOUSEHOLD_MEMBERS = 2`, `INVITE_TTL_DAYS = 7`,
  `READ_NOTIFICATION_TTL_DAYS = 90`; `HouseholdAdminResult` ok/rejected guard.
- Admin actions are modeled **separately from `operationTypes`** — they are
  synchronous, online-only, and executed by security-definer RPCs / service-
  role Edge Functions, not queued through the durable operation queue.
- `packages/domain/src/calendar.ts` — `reminderPresets`
  (`none|at-time|10m|1h|1d|1w`), `isReminderPreset`, and `reminderLeadMinutes`.
- Tests: `households.test.ts` (+8), reminder cases in `calendar.test.ts` (+2).

Verified under arm64 node: `npx vitest run` 35 files / 226 passed;
`npm run lint` clean; `npm run build` clean.

### Done: 3A DB (`f283ad3`)

`supabase/migrations/20260725013000_household_admin_operations.sql` — seven
security-definer RPCs: `onboard_household`, `create_household_invite`,
`revoke_household_invite`, `redeem_household_invite`,
`transfer_household_ownership`, `remove_household_member`, `delete_household`.
Each takes the actor from `auth.uid()`, derives the household from the actor's
own membership (no household_id parameter → no IDOR), serializes under the
household `FOR UPDATE` lock, enforces the two-member cap, and returns the
shared HouseholdAdminResult shape via a private `mobile_admin_rejected` helper.
Invites store only a sha256 hash of a 32-byte url-safe token; creating a new
invite supersedes the prior active one. Direct client DML stays revoked; only
these seven functions are granted to `authenticated`. **Account deletion
(auth.users removal + created_by reconciliation) is deferred to the 3C Edge
Function.** Tests: `supabase/tests/20260725_household_admin.test.sql` (33
pgTAP assertions). Verified: `supabase db reset --local` clean; `supabase test
db --local` 3 files / **203 tests pass**; `supabase db lint` no errors.

### Done: 3B auth code (`e173e07`)

Shared auth policy in `@household-hub/domain` (`auth.ts`): `oauthProviders`
(`google`, `apple`) + guard, and `isPasswordAuthAllowed` requiring BOTH
non-production AND the test-auth flag (production is OAuth-only, cannot expose
the password path). Web helpers (`src/lib/auth.ts`): `signInWithOAuth`
(redirect `/auth/callback`) and a guarded `signInWithTestPassword`. Verified:
`npx vitest run` 36 files / **228 tests pass**; lint + build clean.
**Deferred to 3D:** `config.toml` external-provider wiring + `.env` templates
(kept with the other config changes so local `db reset`/`start` stays stable).

### Done: 3C DB layer (`1231941`)

`supabase/migrations/20260725014000_notifications_devices_and_jobs.sql`:

- **Tables** — `notification_devices` (Expo token per user+install, platform,
  `disabled_at`, `failure_count`), `calendar_reminder_dispatches` (unique on
  `(event_id, preset, occurrence_start)` → re-timing an event re-fires its
  reminder; a retried scheduler run does not), `notification_push_deliveries`
  (unique on `(notification_id, device_row_id)`). Client DML revoked; only
  `notification_devices` is client-readable (own rows), the two job ledgers are
  not readable at all.
- **Partner-only Calendar activity** — trigger on `household_change_log`
  (written last in `apply_household_operation`, after the receipt, so the actor
  is available). Kinds `calendar.event.created|updated|deleted`, recipients =
  members other than the actor. Deleted events carry `title: null` (the row is
  already gone) but keep `entityId` for the deep link.
- **Authenticated RPCs** — `register_notification_device` (reclaims a token
  Expo reissued to another install so delivery can't strand on a stale row),
  `unregister_notification_device`, `update_user_settings` (appearance +
  notifications_enabled; profile DML stays revoked).
- **Service-role job contract** — `job_calendar_reminder_candidates`,
  `job_record_calendar_reminder` (reminders go to *every* member, unlike
  activity), `job_pending_push_notifications` (skips opted-out recipients,
  disabled devices, and already-delivered pairs), `job_record_push_delivery`,
  `job_disable_notification_device`, `job_active_transfer_schedules`,
  `job_execute_transfer_occurrence` (balanced postings mirroring
  `ledger.transfer.upsert` legs; idempotent on `(schedule_id,
  occurrence_date)`; negative-balance warning without blocking),
  `job_cleanup_read_notifications`, `admin_prepare_account_deletion`.
- **Account deletion** — owner+partner → `must_transfer_ownership`; sole owner
  → household deleted with the account; non-owner → leaves and their authored
  rows are reassigned to the owner via `mobile_reassign_authorship` (every
  `created_by`/`recorded_by` is ON DELETE RESTRICT, legacy page tables
  included, so `auth.users` deletion is otherwise blocked). The Edge Function
  removes the `auth.users` row afterwards.
- **Removed-member cleanup** — trigger on `household_members` delete drops that
  user's devices and inbox rows for the household.

Verified: `supabase db reset --local` clean; `supabase test db --local`
4 files / **292 tests pass** (89 new); `supabase db lint` no errors.

### Done: 3C Edge Functions (`df02de6`)

`supabase/functions/` — five functions plus tested pure modules:

- **`_shared/timezone.ts`** — `Intl`-based offset resolution (Temporal is not
  on the edge runtime). Fall-back wall times resolve to the *earlier* instant;
  spring-forward gap times resolve to the transition instant itself (found by
  a minute-granularity binary search), so a 02:30 anchor on a spring-forward
  day still runs, at 03:00 local.
- **`_shared/reminders.ts`** — all-day events anchor to 09:00 in the event
  timezone while the dispatch key stays the event's own start (so re-timing an
  event re-fires, a retried run does not); `none`/unknown presets never fire;
  reminders past the 60-minute grace window are dropped instead of delivered
  late; candidate window = grace back, longest lead + 1 day forward.
- **`_shared/schedules.ts`** — occurrence enumeration for the four
  frequencies in the schedule's own timezone (wall-clock preserved across
  DST). Monthly re-derives from the anchor day so a February clamp doesn't
  drag later months; semi-monthly pairs the anchor day with one 15 days away;
  a run materializes at most 24 occurrences so an outage catches up in
  bounded batches.
- **`_shared/expo.ts`** — one message per (notification, enabled device),
  malformed tokens dropped, 100-message batches, positional ticket matching;
  a short/missing ticket becomes `MissingTicket` rather than a silent drop,
  and `DeviceNotRegistered` marks the device for disabling.
- **`_shared/http.ts` / `_shared/supabase.ts` / `_shared/json.ts`** — CORS,
  method/body guards, constant-time service-role check, and a dependency-free
  PostgREST/Auth client (no SDK bundle runs with the service-role key, and
  `deno check`/`deno test` work offline).
- **`household-admin`** — one audited entry point for every administration
  action. Strict `{action, payload}` validation mirroring the domain contract;
  RPC actions run as the *caller* (RLS and `auth.uid()` still apply); the
  typed household name is verified against the stored name server-side; account
  deletion runs `admin_prepare_account_deletion` first and only removes the
  `auth.users` row when the database accepted, so a rejection leaves the
  account intact.
- **`calendar-reminder-scheduler`**, **`push-dispatch`**,
  **`recurring-transfer-executor`**, **`notification-cleanup`** — service-role
  only. Push deliveries are recorded per (notification, device); a transport
  failure records nothing so the next run retries, while an Expo-reported
  error is recorded as permanent (the inbox row remains the durable record).

Also: `npm run test:functions` (`deno test supabase/functions/`),
`src/test/edgeFunctionParity.test.ts` (asserts the edge copies of the reminder
presets, admin actions, name/code validation, and the 90-day TTL still match
`@household-hub/domain`), and a Vitest `exclude` for `supabase/**` so Vitest
no longer tries to load the Deno tests.

Verified: `deno test supabase/functions/` **73 passed**; `npx vitest run` 37
files / **233 passed**; `npm run lint` clean; `npm run build` clean;
`deno check` clean.

### Done: 3D config and deployment (`24a5b39`)

- **`supabase/config.toml`** — `[functions.*]` for all five functions with
  `verify_jwt = true`; `[auth.external.google]` beside Apple (both disabled
  locally unless the client id/secret are exported); web `/auth/callback` and
  native `householdhub://auth/callback` redirect URLs; `site_url` corrected to
  the Vite dev port.
- **Env templates** — `.env.example` and `mobile/.env.example` name every
  variable (web, Expo, seed script, local provider secrets, function secrets)
  with none of their values.
- **Seed fixtures** — `scripts/seed-household.ts` now provisions through the
  real path (`onboard_household` → `create_household_invite` →
  `redeem_household_invite`) instead of writing `households`/
  `household_members` directly, so seeded rows carry owner role, profiles, and
  invite redemption state. Still idempotent (membership check is scoped to the
  partner's own row — a member can read both).
- **`src/types/database.ts`** — regenerated from the local stack. This
  surfaced that the pre-rebuild Calendar screen assumed non-null
  `start_at`/`end_at`, which Task 2 widened; it now goes through
  `toLegacyCalendarEvent` (all-day rows are filtered out of that screen) until
  Task 6 replaces it.
- **`vercel.json`** — SPA rewrite plus cache headers: hashed `/assets`
  immutable for a year; `index.html`, `sw.js`, and the web manifest must
  revalidate.
- **Expo** — `mobile/app.json` carries the release identity (`householdhub`
  scheme, `com.conlegs.householdhub`, portrait, `supportsTablet: false`,
  `POST_NOTIFICATIONS`); `mobile/eas.json` defines development/preview/
  production profiles. `app.json`, `.gitignore`, and `assets/` were previously
  untracked and are now committed (the remaining Task 1 review gap).
  `expo-notifications` and its config plugin arrive in Task 7, so no plugin
  block is declared yet.
- **`docs/deployment/mobile-first-rollout.md`** — env matrix, migration
  preflight, OAuth setup, function deploy + cron cadences, Vercel, EAS, and
  seeding. No provider secrets.

#### Defect found by end-to-end verification (fixed)

Running the real functions against the local stack showed a partner could
**never delete their account**: `admin_prepare_account_deletion` accepted, then
removing the `auth.users` row failed because
`household_invites.redeemed_by` used `ON DELETE SET NULL` while the table
requires `redeemed_at`/`redeemed_by` to be null or non-null together.
`supabase/migrations/20260725015000_invite_redeemer_deletion.sql` cascades the
spent invite with its redeemer;
`supabase/tests/20260725_invite_redeemer_deletion.test.sql` (9 assertions)
fails against the old constraint and passes with the new one.

## Task 3 — complete

### Task 3 verification baseline (at `24a5b39`)

| Verification | Result |
| --- | --- |
| `supabase db reset --local` | Passed |
| `supabase test db --local` | 5 files, **301/301 passed** |
| `supabase db lint --local --schema public --level warning --fail-on error` | No errors |
| `npm run test:functions` (Deno) | **73/73 passed** |
| `npx vitest run` | 37 files, **233/233 passed** |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `supabase gen types typescript --local` | Matches the committed file |

Live end-to-end against the local stack (`supabase functions serve`, all five
functions booted):

- job functions reject an anon key (`forbidden`) and accept the service role;
- `notification-cleanup` rejects `ttlDays: 0`, runs with the default 90;
- `household-admin` rejects unauthenticated calls, unknown actions, non-POST
  verbs, and a mistyped household name (reporting the expected name);
- a seeded partner deleted their own account (authorship reassigned to the
  owner, household intact), the owner then created an invite, and finally
  deleted their own account, taking the household with it.

### Known Task 3 risks carried forward

1. **Permanently failing push batch** — a batch Expo never accepts records no
   delivery row (so it retries), which means a message Expo rejects at the
   transport level retries on every run. Bounded by the 100-notification page,
   but worth an attempt cap if it is ever observed.
2. **No independent review agent was run** for Task 3. The session directive
   is not to dispatch subagents, so this was a self-review plus the live
   end-to-end run above. `/code-review` on this branch remains available and
   is the recommended follow-up.
3. **Nothing deployed remotely.** All verification is local; no hosted
   Supabase project, Vercel deployment, or EAS build was touched.
4. **Expo push not exercised against Expo's servers** — batching and ticket
   handling are unit-tested; real delivery needs the Task 7 development build.

## Task 4 — Durable web operation queue (complete)

### Done: queue core (`dba54b5`)

`src/lib/operations/` — the rebuilt clients' only write path.

- **`types.ts`** — `QueuedOperation` (command, device id, local FIFO sequence,
  optimistic state, attempts, last error) and `DiscardedOperation` (the losing
  command, the winner, code/reason/details, acknowledgement).
- **`device.ts`** — device id persisted in IndexedDB (a new id every session would
  restart the server's per-device ordering mid-stream); local sequence
  allocated inside a transaction so concurrent enqueues cannot collide.
- **`queue.ts`** — durable-first enqueue (stored before any network attempt),
  then a FIFO replay against `apply_household_operation`:
  - `applied` / `duplicate` → leave the queue;
  - `conflict` / `rejected` → leave the queue as a permanent discard record;
  - transport failure → **stop the pass**, do not skip ahead (order is part of
    the contract and a later command may depend on an earlier one);
  - an unrecognized response is treated as a transport failure, never as a
    verdict, so a write is never silently dropped;
  - single in-flight guard, and identifiers validated (not cast) at the
    boundary through the domain's `isUuid`/`isRevision`.
- **`overlay.ts`** — optimistic overlays derived from the queue itself, so a
  Realtime refetch cannot erase an unsent local edit, and the overlay survives
  a reload exactly as the commands do. Per-entity queued commands apply in
  local sequence order.
- **`src/lib/db.ts`** — Dexie v2 adds `operations` and `discardedOperations`.
  The legacy `outbox` stays until Task 6 retires the legacy screens with it.
- **`AppShell`** — registers the query client and starts the sync loop
  (online, visibility, 30s fallback) beside the legacy one.

### Done: explanations and status (`098f643`)

`explainDiscard` turns a discard record into the account the design requires —
the action that failed, the one that won, the server's wording, and the stable
code — because a losing command is never retried or edited.
`useOperationQueueStatus` / `useDiscardedOperations` are live Dexie queries for
the Task 5 shell.

### Done: Realtime reconciliation (`336a89d`)

`useHouseholdRealtime` subscribes once per household to
`household_change_log` (written by every applied operation) instead of one
channel per table; an event invalidates the household's queries and nudges the
queue, and the refetch goes back through the overlay.

### Task 4 verification (at `f86f4c0`)

| Verification | Result |
| --- | --- |
| `npx vitest run` | 40 files, **267/267 passed** (34 new) |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `npm run test:functions` | 73/73 passed |
| `supabase test db --local` | 5 files, 301/301 passed |

New coverage: offline CRUD, reconnect replay in FIFO order, recovery after a
reload, duplicate verdicts, transport-failure stop-and-resume, unrecognized
responses, conflict and rejection discard, acknowledgement, two-device
ordering (one entity lost to the partner while the rest of the queue still
applied in order), overlay behavior for create/edit/delete, and Realtime
reconciliation.

### Remaining for Task 4

- Nothing functional is outstanding for the queue itself. The remaining plan
  items for Task 4 (a visible pending/conflict surface) land with the shell in
  Task 5, which owns every UI state.

## Original Task 3 scope (unchanged reference)

Task 4 start was **pre-approved** by the user (see "User directive" above).

### Task 3 scope

- Google OAuth for web and native callback contracts
- Apple OAuth for web and native callback contracts
- local/test-only email/password path guarded by development mode and an
  explicit test-auth flag
- first-user household creation and ownership
- seven-day, one-time invitation link/code
- invitation regeneration, revocation, and redemption
- maximum two active household members
- ownership transfer
- partner removal
- account and household deletion rules
- Edge Functions for:
  - household invitations/admin
  - Expo push dispatch
  - Calendar reminder scheduling
  - recurring Asset transfer execution
  - read-notification cleanup after 90 days
- reminder presets:
  - none
  - at time
  - 10 minutes
  - one hour
  - one day
  - one week
- partner-only Calendar activity notifications
- Supabase config and environment templates
- local seed fixtures
- generated database TypeScript types
- Vercel cache/environment configuration
- Expo scheme, application identifiers, permissions, and EAS profiles
- deployment documentation without provider secrets

### Task 3 acceptance boundary

Task 3 should stop after:

- implementation is committed
- focused tests pass
- full affected verification passes
- an independent task review has no open Critical or Important issues
- a detailed checkpoint report is provided to the user

Do not start Task 4 until the user approves continuing.

---

## Task 5 — responsive web shell + visual system (complete)

Built beside the legacy Swiss theme; legacy page screens stayed **unrouted** in
the tree until Task 6 retired them. Sub-checkpoints (each committed + verified):

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
  reviewed (session directive: no subagents). The sessionless bypass used at
  that historical checkpoint has since been removed; authenticated local
  feature testing is now available through the test household.
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
  standalone cleanup. **Verification:** `npx vitest run` **353 passed**
  (60 files; +5), lint clean, build clean. Not independently reviewed (session
  directive: no subagents).

## Web parity correction pass (complete)

Canonical design and execution documents:

- `docs/superpowers/specs/2026-07-25-web-parity-corrections-design.md`
- `docs/superpowers/plans/2026-07-25-web-parity-corrections.md`

### Correction Task 1 — Calendar operation contract (complete)

**User-visible result**

- Timed and all-day events now save through the real operation RPC.
- The **At time** reminder now persists and reloads correctly.
- A final server rejection no longer dismisses the event form. The form stays
  open and shows the server explanation, so the entered values are not hidden.
- Offline/durably queued saves still close normally because the queue has
  accepted responsibility for replay.
- Event deletion uses the same final-outcome rule.

**Root causes and corrections**

1. `buildEventPayload` sent the inactive temporal fields as explicit `null`
   values. The server validator requires one discriminated branch:
   timed events have only `startAt`/`endAt`; all-day events have only
   `startDate`/`endDate`. Payload construction now omits the inactive keys.
2. The shared UI model calls the immediate reminder `at-time`, while Supabase
   stores `at_time`. `src/features/calendar/reminders.ts` now owns the explicit
   two-way adapter; `none` is never persisted.
3. `enqueueOperation` reports a rejected/conflicted command as a resolved
   `discarded` outcome. `EventSheet` previously treated every resolved promise
   as success and closed. `src/lib/operations/outcome.ts` now turns only the
   final discarded result into a form error.

**Regression coverage**

- `src/test/calendarMutations.test.ts`: disjoint temporal payload branches and
  reminder serialization.
- `src/test/calendarReminders.test.ts`: complete supported reminder mapping,
  `none`, and unknown stored values.
- `src/test/operationOutcome.test.ts`: queued, settled, and discarded outcomes.
- `src/test/CalendarScreen.test.tsx`: discarded save stays visible; queued save
  closes.
- `src/test/calendarDatetime.test.ts`: older assertions updated from the invalid
  null-key contract to the required omitted-key contract.

**Authenticated local Supabase evidence**

- Signed in as `yongju@test.local`. Created a timed event, an all-day event, and
  a timed event with **At time** plus **10 min** reminders; edited the first
  event. All four RPC results were `applied`, at server sequences 24–27. Stored
  rows had the correct mutually exclusive temporal columns and reminder rows
  (`at_time`, `10m`). The three temporary events were removed through three
  successful `calendar.event.delete` operations (sequences 28–30).

**Verification at this checkpoint:** Full Vitest **64 files, 366 tests passed**;
ESLint clean; production TypeScript/Vite/PWA build clean (existing non-blocking
large-chunk warning retained).

### Correction Task 2 — Grocery parity workflows (complete)

- Added migration `20260725016000_grocery_purchase_dates.sql`. The database,
  not the client, assigns `checked_at` on first check, preserves it during
  checked-item edits, clears it on uncheck, and replaces it on recheck.
- Checked items sort by newest purchase first and display the local purchase
  date. List titles use the shared accessible `EditableTitle` component and
  inspect final operation outcomes.
- Autocomplete combines current item names and immutable price history across
  the whole household, deduped case-insensitively. Activating an item displays
  its five cheapest recorded prices, ascending, with the Grocery list/store and
  date for every entry.
- Local Supabase was reset through the new migration; all database tests passed
  (**5 files, 310 tests**) and generated database types were refreshed.
- Web verification: **65 files, 376 tests passed**; ESLint, TypeScript, Vite/PWA
  build, and `git diff --check` passed.

### Correction Task 3 — Ledger annual/monthly workflows (complete)

**User-visible result**

- `/ledger` is list-first again: each Statement year has its own expandable
  annual chart control and a separate chevron into the 12-month detail route.
- `+ Year` opens a four-digit year form, rejects a duplicate locally, and uses
  a new entity UUID for a valid year.
- `/ledger/:yearId` now contains the reference-style 4×3 month picker, actual
  income/spending donut and legend, monthly budget utilization, Spent/Limit/Left
  cards, category progress, and visible Income and Spending histories.
- Income and spending have separate add buttons and fixed-category-kind forms.
  Existing transactions can be edited or deleted; deletion reverses the linked
  Asset posting. New years receive Salary, Bonus, RRSP, TFSA, ESPP, and
  Government benefit income categories in every month.

**Database design**

- Migration `20260725017000_ledger_default_income_categories.sql` adds one
  idempotent security-definer helper and insert triggers on years/months.
  Existing years are backfilled with missing defaults only; custom categories
  remain untouched. Database coverage verifies six category rows, 72
  month-category rows, and six entity-revision rows for each new year.

**Authenticated operation evidence**

- Signed in as `yongju@test.local` against local Supabase using the real
  `apply_household_operation` RPC. Created a CAD Asset, a 2026 year, one income
  and one spending transaction (Asset `$100.00`→`$1,800.00`); edited spending
  `$300.00`→`$250.00` (Asset `$1,850.00`); deleted both (Asset back to
  `$100.00`). The year had exactly six default income categories.

**Verification at this checkpoint:** Supabase **5 files, 313 tests passed**; Web
**67 files, 384 tests passed**; ESLint, TypeScript, Vite/PWA build, generated
types, and `git diff --check` passed.

### Correction Task 4 — Notes read mode and explicit editing (complete)

- Notes now open as semantic plain content. The read renderer supports body
  paragraphs, H1–H3, bullet lists, numbered lists, nested list content,
  checked/unchecked checklist items, hard breaks, empty documents, and safely
  ignores unsupported nodes.
- Edit and title activation enter one local draft containing both title and
  document. The editor updates that draft immediately but performs no network
  autosave. Save sends exactly one `note.upsert`; Cancel discards every local
  change. A final discarded/conflicted Save remains open with its explanation.
  A queued Save returns to read mode using a local accepted snapshot.
- Authenticated local verification created the complete heading/bullet/
  numbered/checklist document as Yongju, read the same document as Claire, and
  then deleted it through the real operation RPC.
- Web verification: **68 files, 390 tests passed**; ESLint, TypeScript,
  Vite/PWA build, and `git diff --check` passed.

### Correction Task 5 — Trip currency and Asset workflow (complete)

- Destination setup is grouped and previewed as
  `destination · IANA timezone · ISO currency`. Currency remains fully manual,
  normalizes to uppercase while typing, and must be a real three-letter ISO
  code.
- Trip names now use the same inline editor as Grocery lists; rename commands
  preserve destination, timezone, dates, currency, and revision.
- Expense currency choices are exactly CAD plus destination currency
  (deduped). The Paid from control contains only Assets whose stored currency
  matches the selected expense currency and resets safely when currency
  changes. When no matching Asset exists, Save is disabled and the sheet links
  directly to `/ledger?segment=assets`; Ledger now honors that deep link.
- Authenticated local verification for a GBP Trip recorded separate totals of
  CAD `$20.00` and GBP `£70.00`. The CAD Asset moved to `$80.00`, GBP cash to
  `£430.00`, and only the CAD expense produced a linked Travel Ledger row.
- Web verification: **70 files, 398 tests passed**; ESLint, TypeScript,
  Vite/PWA build, and `git diff --check` passed.

### Correction Task 6 — Cross-feature verification and handoff (complete)

- Confirmed `.env.local` points to loopback Supabase at `http://127.0.0.1:55321`
  before resetting. Replayed every migration and ran the complete database test
  suite: **5 files, 313 tests passed**; Supabase schema lint clean.
- Recreated the two-member `🐰 & 🐧 Test` household through the real onboarding
  and invitation path. Seeded 26 real `apply_household_operation` commands
  (Calendar event; two Grocery lists with items, purchase dates, and six price
  records; CAD and GBP Assets; 2026 income/spending/limits/charts and the
  auto-linked 2027 Travel statement; a semantic checklist Note; a London Trip
  with separate CAD `$5,309.00` and GBP `£2,409.00` totals).
- Exercised authenticated routes in Chrome at **402×874** phone and
  **1440×1000** desktop sizes; header actions, five-tab phone navigation,
  desktop left pane, cards, segmented controls, charts, scrolling, and
  fixed-bottom spacing matched the approved visual system. Browser
  instrumentation reported **zero page errors and zero console errors**.
  Disabled Recharts animation for the statement donut so the complete chart is
  deterministic in first paint and screenshots.
- Final web verification: **70 files, 398 tests passed**; ESLint, TypeScript,
  Vite/PWA production build, and `git diff --check` passed. Final backend
  verification: **5 database files, 313 tests passed**; `supabase db lint
  --local` clean; Edge Function tests **73 passed**.
- Itinerary, Bookings, and Checklist remain explicit future Trip schema work;
  Expenses is the fully implemented fourth Trip tab in this correction scope.

**Correction commits**

| Task | Commit |
| --- | --- |
| Calendar contract | `b7a33b7 fix: align Calendar operation contract` |
| Groceries parity | `876d532 feat: restore Grocery parity workflows` |
| Ledger workflows | `9523b77 feat: complete Ledger statement workflows` |
| Notes read/edit modes | `bfd8d5d feat: add Notes read and explicit edit modes` |
| Trip currency workflow | `2b18d9e feat: clarify Trip currency expense flow` |
| Final handoff | `071b43b docs: complete web parity correction handoff` |
