# Household Hub Mobile-First Implementation Progress

**Last updated:** 2026-07-24

**Canonical continuation file:** `progress.md`

**Implementation branch:** `codex/household-hub-mobile-first`

**Implementation worktree:** `/Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first`
**Current HEAD:** `e173e07 feat: add auth policy and OAuth/test-password entry points`
**Last review-clean baseline:** `d1f3e30` (Tasks 1–2). Task 3 in progress on top (3A + 3B code complete).

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
   - `CLAUDE.md`
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

5. Resume at **Task 3**. Do not redo Tasks 1 or 2.

6. The user requested a checkpoint after every task. Finish implementation,
   tests, and independent review for one task, then stop and provide a detailed
   report before starting the next task.

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
| 3. Identity, notifications, jobs, deployment config | In progress | 3A + 3B done; 3C Edge Functions + 3D config/deploy remain |
| 4. Durable web operation queue | Pending | Not started |
| 5. Responsive web shell and visual system | Pending | Not started |
| 6. Web feature flows | Pending | Not started |
| 7. Expo foundation and offline data layer | Pending | Not started |
| 8. Expo feature parity and visual implementation | Pending | Not started |
| 9. Reset procedure, E2E verification, release handoff | Pending | Not started |

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

### Remaining Task 3 sub-checkpoints (not started)

- **3C Edge Functions** — invite-admin (incl. redemption + account deletion),
  push-dispatch, calendar-reminder-scheduler (all-day → 09:00 event tz),
  recurring-transfer-executor, notification-cleanup (90-day); partner-only
  calendar activity notifications; Deno unit tests on extracted pure logic.
- **3D config/deploy** — `config.toml` `[functions]`, `.env.example`, seed
  fixtures, regenerated `src/types/database.ts`, `vercel.json`, Expo
  `app.json` (`householdhub://`, `com.conlegs.householdhub`, portrait-only),
  `eas.json`, deployment docs — no secrets.

Then run the full baseline (db reset + pgTAP + lint/build/test + deno tests),
self-review for Critical/Important issues, update this file, and deliver the
Task 3 checkpoint report before starting Task 4.

## Original Task 3 scope (unchanged reference)

Do not start Task 4 without the user’s approval.

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
