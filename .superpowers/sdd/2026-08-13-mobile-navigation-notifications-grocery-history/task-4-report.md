# Task 4 Report: Shared Contracts, Migration, and Server Rules

## Status

DONE_WITH_CONCERNS. Task 4 is implemented in one new forward migration and shared domain/application modules. The migration is applied to the local Supabase stack. Canonical Grocery operations now persist exact purchase quantity, total, and occurrence metadata while the original six-key web payload remains valid.

## Files

- `packages/domain/src/mobileNavigation.ts`
- `packages/domain/src/mobileNavigation.test.ts`
- `packages/domain/src/operations.ts`
- `packages/domain/src/operations.test.ts`
- `packages/domain/src/index.ts`
- `packages/application/src/operations/overlay.ts`
- `packages/application/src/operations/index.ts`
- `mobile/src/components/mobileNavigation.ts`
- `mobile/src/lib/operations/overlay.ts`
- `src/lib/operations/overlay.ts`
- `src/test/applicationOperations.test.ts`
- `src/test/operationQueue.test.ts`
- `supabase/migrations/20260813022000_grocery_purchase_history.sql`
- `supabase/tests/20260813_grocery_purchase_history.test.sql`

## Implementation

- Moved the validated three-destination mobile-navigation tuple into `@household-hub/domain` and kept mobile helpers as consumers/re-exports.
- Added an exhaustive operation-to-entity map plus strict settings, notification-removal, legacy Grocery, and canonical Grocery payload guards.
- Moved the pure optimistic overlay to `@household-hub/application`; web and native retain only storage adapters. The shared projection preserves FIFO order, tenant filtering, notification clear, Ledger clear, and legacy revision repair.
- Added canonical Grocery item/history columns, safe legacy backfills, positive/exactness constraints, immutable store snapshots, occurrence indexes, and server reconciliation based on exact total/quantity ratios.
- Added a dedicated Grocery operation path with the original command hash, household lock, membership recheck, revision/conflict lifecycle, receipt/change-log idempotency, authoritative list/store lookup, and internal-function grant revocation.
- Preserved the full current RPC chain by renaming the notification-aware public RPC to `apply_household_operation_v4` and delegating every non-Grocery operation to it.
- Corrected `settings.update` duplicate replay so profile post-processing occurs only for `applied`, preventing an older replay from restoring stale preferences.

## TDD Evidence

### RED

- `npm test -- --run packages/domain/src/operations.test.ts packages/domain/src/mobileNavigation.test.ts src/test/applicationOperations.test.ts`
  - Result: 3 test files failed; 7 tests failed and 11 passed.
  - Expected failures: missing shared navigation/application exports and permissive operation validation.
- `supabase test db --local supabase/tests/20260813_grocery_purchase_history.test.sql`
  - Result: the first 8 schema assertions failed, followed by missing `mobile_apply_grocery_item_upsert(jsonb)`.

### GREEN

- `npm test -- --run packages/domain/src/operations.test.ts packages/domain/src/mobileNavigation.test.ts src/test/applicationOperations.test.ts src/test/operationQueue.test.ts`
  - 4 files passed; 42 tests passed.
- `cd mobile && npm test -- --runInBand src/components/mobileNavigation.test.ts src/lib/operations/queue.test.ts src/features/notifications.test.ts`
  - 3 suites passed; 27 tests passed.
- `cd mobile && npm run typecheck`
  - Passed with no diagnostics.
- `npm run build`
  - Passed; Vite built 1,264 modules.
- `supabase migration up --local`
  - Applied `20260813022000_grocery_purchase_history.sql` successfully.
- `supabase test db --local supabase/tests/20260813_grocery_purchase_history.test.sql`
  - 69 tests passed.
- `supabase test db --local supabase/tests/20260725_mobile_first_operations.test.sql`
  - 107 tests passed.
- `supabase test db --local`
  - 8 files and 437 tests passed before the final five focused, test-only constraint assertions were added; the final focused file then passed 69/69.
- `npx eslint` over every changed TypeScript file
  - Passed with no diagnostics.
- `git diff --check`
  - Passed with no output.
- `supabase migration list --local`
  - Local and remote migration ledgers match through `20260813022000`.

## Self-review

- Verified late price creation uses the trigger-owned original `checked_at`; same-occurrence edits and collision merges retain that purchase date and the edited occurrence row.
- Verified later rechecks receive a new occurrence, while the same normalized name/list/store/exact ratio advances one row; equivalent fractions merge and ratios that merely round to the same cent stay separate.
- Verified store names are snapshots, source item IDs have no item foreign key, and the existing `ON DELETE SET NULL` list relationship preserves history after item/list deletion.
- Verified exact replay produces one receipt/change/history mutation, changed reuse of an operation ID rejects, stale revisions conflict before mutation, and cross-household/outsider access rejects.
- Verified renamed validators/helpers/RPCs are not client-callable and the current RPC retains authenticated/service-role access.
- Preserved legacy behavior: the six-key web payload derives quantity 1 and total equal to its positive legacy unit price. Canonical unchecked prices persist on the item but do not create purchase history.

## Concerns

- No multi-session concurrency stress harness was added. Concurrency safety is implemented with the same trusted household-row lock used by the existing operation RPC and exact-ratio reconciliation executes under that lock.
- Native manual QA is deferred to Task 5.
- Repository-wide `npm run lint` still reports 12 pre-existing errors in Task 1/2 mobile UI files (`index.test.tsx`, `index.tsx`, `AppChrome.tsx`, and `MobileNavigationEditor.tsx`); every Task 4 TypeScript file passes targeted ESLint.
- Clearing canonical price fields from an already recorded checked occurrence preserves the historical purchase row; no product rule requested destructive history removal.

## Fix round 1

All six round-1 findings are fixed. No TypeScript changed: every finding was
server-side, so the shared contracts, overlays, and native/web adapters are
untouched.

### Migration strategy

`20260813022000_grocery_purchase_history.sql` was **amended in place** rather
than followed by a new forward migration. Reasoning:

- It is unpushed and unmerged, and lives on this same branch, so no deployed
  ledger anywhere references its old body.
- Findings 4 and 5 change the shape of the very backfills that migration
  performs: `source_list_id` must be populated *before* the legacy exact-ratio
  dedupe runs (that dedupe partitions on it now), and the occurrence ledger
  must be seeded from the same `gen_random_uuid()` occurrence ids the item
  backfill mints. Splitting those into a follow-on would have run the legacy
  dedupe once on the wrong key and then required a second corrective pass.
- Amending keeps one coherent Task 4 migration for the phase, matching the
  repo's "one migration per build phase" convention.

Because it was amended, the local stack was rebuilt with `supabase db reset
--local`, then verified with `supabase migration up --local` (no pending
migrations) and `supabase migration list --local` (local and remote ledgers
match through `20260813022000`).

### Behavior visible to the web app

1. **Entering a price on an unchecked item no longer records purchase
   history** (finding 1). The six-key web payload is still accepted verbatim
   and still derives `purchase_quantity = 1` / `total_price_cents = unit
   price` onto the item; only the history write now waits for `checked=true`.
   This is the brief's rule that history represents purchases, not entered
   prices.
2. **Editing the price of an already-checked item corrects that purchase's
   history row instead of appending a new one.** Both payload shapes now share
   one occurrence-keyed history path.
3. Legacy payloads are deliberately *not* subject to the finding-6 rejection:
   a six-key command may still clear the price of a checked item (existing web
   behavior). Only canonical commands, which own an occurrence id, are
   rejected for it.

### Finding 1 — legacy unchecked priced writes created history

Changed `supabase/migrations/20260813022000_grocery_purchase_history.sql:837-841`
(the `should_record_history` branch) from a canonical/legacy split to a single
`checked AND total_price_cents is not null` gate.

Tests: replaced the assertion that codified unchecked history in
`supabase/tests/20260813_grocery_purchase_history.test.sql:1155-1231` with a
no-history assertion plus a follow-on checked purchase; updated the two other
tests that codified it —
`supabase/tests/20260725_mobile_first_operations.test.sql:1497` (now expects 0,
with a new purchase assertion at :1547-1559) and
`supabase/tests/20260727_grocery_price_history_list_deletion.test.sql:124,233`
(its two priced items are now actual purchases).

RED — `supabase test db --local supabase/tests/20260813_grocery_purchase_history.test.sql`:

```
# Failed test 60: "a legacy unchecked priced write records no purchase history"
#         have: 1
#         want: 0
```

RED — `supabase test db --local supabase/tests/20260725_mobile_first_operations.test.sql supabase/tests/20260727_grocery_price_history_list_deletion.test.sql`:

```
# Failed test 76: "an entered price on an unchecked item is not yet a purchase"
#         have: 1
#         want: 0
```

GREEN — see the combined run at the end of this section.

### Finding 2 — cross-household entity-ID collision bypassed durable rejection

Added a foreign-owner guard at
`supabase/migrations/20260813022000_grocery_purchase_history.sql:667-682`,
immediately after the household-scoped item lookup: a base-null command whose
`entityId` already exists under any household now returns
`mobile_store_rejection(... 'entity_owned_by_other_household' ...)`.

Test: `supabase/tests/20260813_grocery_purchase_history.test.sql:1844-1930`
(other household claims a UUID, this household is rejected, rejection receipt
stored, foreign item unchanged).

RED (old function, trimmed copy of the same scenarios):

```
psql:.../zz_red_scenarios.test.sql:1553: ERROR:  duplicate key value violates unique constraint "household_grocery_items_pkey"
DETAIL:  Key (id)=(50000000-0000-4000-8000-0000000000fe) already exists.
```

A raw 23505 aborting the transaction — exactly the bypass of durable
rejection/receipt handling the finding describes.

### Finding 3 — `mobile_expected_entity_type(text)` kept default PUBLIC execute

Added the revoke at
`supabase/migrations/20260813022000_grocery_purchase_history.sql:982-984`
(with a comment naming `20260813020000` as the migration that reintroduced it).
Extended the privilege coverage test at
`supabase/tests/20260725_mobile_first_operations.test.sql:199-209`.

RED — `supabase test db --local supabase/tests/20260725_mobile_first_operations.test.sql`:

```
# Failed test 4: "navigation validation helpers are not client-callable"
```

### Finding 4 — exact-ratio identity used the nullable live `list_id`

Added the immutable, FK-free `source_list_id` column at
`supabase/migrations/20260813022000_grocery_purchase_history.sql:35-38`,
backfilled it at :55-57 (`coalesce(list_id, gen_random_uuid())` — rows whose
list was already gone get a private identity rather than merging unrelated
purchases), repartitioned the legacy dedupe on it at :70, made it `not null`
at :84, and moved the purchase-lookup index onto it at :106. Matching now uses
it in `mobile_upsert_grocery_purchase_history`: the bucket is taken from
`occurrence_history.source_list_id` (:323) and the collision predicate is a
plain equality (:332). Inserts stamp it from the authoritative list id
(:382,:397); no update path ever rewrites it.

Test: `supabase/tests/20260813_grocery_purchase_history.test.sql:1475-1642` —
two same-named child pages each record an identical Widget purchase, one item
moves to a surviving page, both pages are deleted, and correcting the surviving
occurrence must leave two rows with two distinct `source_list_id`s. Schema
assertions (column present, not null, no foreign key) at :150-179.

RED (old function): the two purchases collapsed into one.

```
# Failed test 78: "identical purchases from two deleted pages never merge"
#         have: 1
#         want: 2
```

### Finding 5 — exact-ratio merge let a displaced occurrence be reused

Added the append-only ledger
`public.household_grocery_purchase_occurrences` at
`supabase/migrations/20260813022000_grocery_purchase_history.sql:111-162`
(household-scoped PK, RLS on, all privileges revoked from `public`/`anon`/
`authenticated`, a `before update or delete` trigger raising `23001`
"grocery purchase occurrences are append-only" — the sole exception being the
household cascade, which deletes the parent row first, and a backfill from the
existing checked items). The reuse check now consults the ledger rather than
history at :709-725, and every newly attached occurrence is appended at
:767-775 after all rejection paths.

Test: `supabase/tests/20260813_grocery_purchase_history.test.sql:1643-1776` —
occurrence A recorded, occurrence B merged over it, the merged row proven to
carry only B, then reuse of A rejected with a durable receipt; plus ledger
privilege and append-only assertions.

RED (old function): reuse of the displaced occurrence was not rejected at all
and instead blew up on the item-level occurrence index.

```
psql:.../zz_red_scenarios.test.sql:1680: ERROR:  duplicate key value violates unique constraint "household_grocery_items_purchase_occurrence_key"
DETAIL:  Key (household_id, purchase_occurrence_id)=(10000000-0000-4000-8000-0000000000e1, 60000000-0000-4000-8000-0000000000d1) already exists.
```

### Finding 6 — clearing a canonical price left stale history

Added the rejection at
`supabase/migrations/20260813022000_grocery_purchase_history.sql:728-746`: a
canonical checked command that keeps the same occurrence, carries no total
price, and targets an occurrence that already has a history row is rejected as
`purchase_price_cleared`.

Test: `supabase/tests/20260813_grocery_purchase_history.test.sql:1779-1842`.

RED (old function): the clear applied, leaving the item unpriced while history
still held the purchase.

```
# Failed test 71: "clearing the price of a recorded purchase is rejected"
#         have: NULL
#         want: purchase_price_cleared
# Failed test 72: "the rejected clear leaves the purchase and its item untouched"
#         have: {"itemTotal": null, "historyTotal": 400}
#         want: {"itemTotal": 400, "historyTotal": 400}
```

### GREEN — full verification

`npm test -- --run packages/domain/src/operations.test.ts packages/domain/src/mobileNavigation.test.ts src/test/applicationOperations.test.ts src/test/operationQueue.test.ts`

```
 Test Files  4 passed (4)
      Tests  42 passed (42)
```

`cd mobile && npm test -- --runInBand src/components/mobileNavigation.test.ts src/lib/operations/queue.test.ts src/features/notifications.test.ts && npm run typecheck`

```
Test Suites: 3 passed, 3 total
Tests:       27 passed, 27 total

> mobile@1.0.0 typecheck
> tsc --noEmit
```

`supabase migration up --local`

```
{"applied":[],"message":"Migrations applied"}
```

`supabase migration list --local` — local and remote ledgers match through
`20260813022000`.

`supabase test db --local supabase/tests/20260813_grocery_purchase_history.test.sql`

```
All tests successful.
Files=1, Tests=100,  0 wallclock secs
Result: PASS
```

`supabase test db --local supabase/tests/20260725_mobile_first_operations.test.sql`

```
All tests successful.
Files=1, Tests=108,  1 wallclock secs
Result: PASS
```

`supabase test db --local`

```
All tests successful.
Files=8, Tests=474,  1 wallclock secs
Result: PASS
```

`git diff --check` — no output.

No ESLint run was needed: no TypeScript file changed in this round.

### Observations (not acted on)

- `src/types/database.ts` and `mobile/src/types/database.ts` predate this
  migration's new `source_list_id` column and
  `household_grocery_purchase_occurrences` table. Nothing reads either, and
  both typechecks pass, but CLAUDE.md's "regenerate types after any migration"
  rule is technically outstanding for Task 4 as a whole. Left alone as
  out-of-scope for these six findings.
- `mobile/app/(tabs)/index.test.tsx` still sits inside the Expo Router `app/`
  directory. Noted only; deliberately not moved.
- Concurrency is still proven only structurally (household row lock) — the
  two-session test remains deferred per the findings document.

## Fix round 2

Three follow-up items from the scoped re-review of `5507f7c`. No production SQL
changed in this round: the migration is untouched, and the legacy six-key
price-clear path is deliberately left as-is (parked by decision, not oversight).

### 1. Regenerated database types

Both `src/types/database.ts` and `mobile/src/types/database.ts` were
regenerated from the local stack, which already has the amended migration
applied, so no hosted credentials were needed:

```
supabase gen types typescript --local --schema public \
  | perl -0pe 's/\n+\z/\n/' > src/types/database.ts
supabase gen types typescript --local --schema public \
  | perl -0pe 's/\n+\z/\n/' > mobile/src/types/database.ts
```

`--schema public` matches what the committed files contained (no
`graphql_public` block). The `perl` step is a deterministic trailing-newline
trim, not an edit: the CLI emits a final `\n\n`, the previously committed files
ended in a single `\n`, and without the trim `git diff --check` reports "new
blank line at EOF". Apart from that one byte, the files are byte-identical to
generator output — verified by piping a fresh generation straight into `diff`:

```
$ supabase gen types typescript --local --schema public | diff - src/types/database.ts
src: byte-identical to generator output
$ supabase gen types typescript --local --schema public | diff - mobile/src/types/database.ts
mobile: byte-identical to generator output
```

(That check was run before the newline trim was introduced; the two files
remain identical to each other, confirmed with `diff`.) Nothing was
hand-edited, and nothing was hand-reverted.

**The diff is 184 lines per file and most of it is honest pre-existing drift.**
The committed files had clearly been maintained by hand — new columns were
appended to the end of each `Row`/`Insert`/`Update` block instead of being
regenerated, so the generator's alphabetical ordering accounts for a large
share of the churn. Beyond ordering, regeneration adds these previously missing
entries, only two of which come from this branch's amended migration:

- From **this branch's Task 4 migration**:
  `household_grocery_price_history.source_list_id` and the
  `household_grocery_purchase_occurrences` table.
- **Pre-existing drift from Task 2** (`20260813020000`):
  the `calendar_event_deletion_snapshots` table.
- **Pre-existing drift from earlier phases**: the internal RPC wrappers and
  helpers that were never regenerated —
  `apply_household_operation_v1` … `_v4`,
  `mobile_operation_payload_valid_v1` … `_v3`,
  `mobile_expected_entity_type_v2`, `mobile_apply_notification_removal`,
  `mobile_apply_grocery_item_upsert`,
  `mobile_upsert_grocery_purchase_history`, and the
  `trip_expenses` foreign-key relationship ordering.

Per instruction, none of that unrelated churn was reverted by hand.

Generated output is not Prettier-formatted in this repo, and that is
pre-existing convention rather than a new lapse: `npx prettier --check` warns
on the `HEAD` version of `src/types/database.ts` exactly as it warns on the
regenerated one.

Both typechecks pass:

```
$ npx tsc -b
web tsc exit=0

$ cd mobile && npm run typecheck
> mobile@1.0.0 typecheck
> tsc --noEmit
mobile tsc exit=0
```

### 2. Occurrence ledger added to the shared RLS/grant coverage arrays

`supabase/tests/20260725_mobile_first_operations.test.sql:233` adds
`household_grocery_purchase_occurrences` to the RLS-enabled array (expected
count 24 → 25), and `:273` adds it to the array asserting authenticated clients
hold no INSERT/UPDATE/DELETE/TRUNCATE grant.

Neither addition can produce a natural RED, because the table's posture is
already correct — adding a correct row to a coverage array passes immediately.
So the deliverable was proved load-bearing by mutation instead: each array's
oracle was re-evaluated against a deliberately broken posture inside a rolled-
back transaction.

```
=== ARRAY ORACLE: RLS-enabled count (expected 25) ===
 rls_enabled_now
-----------------
              25
ALTER TABLE                      -- disable row level security on the ledger
 rls_enabled_after_mutation
----------------------------
                          24
ROLLBACK

=== ARRAY ORACLE: authenticated write grants (expected 0) ===
 write_grants_now
------------------
                0
GRANT                            -- grant insert on the ledger to authenticated
 write_grants_after_mutation
-----------------------------
                            1
ROLLBACK
```

Both mutations move the count off its asserted value, so the sweep now really
covers the ledger.

### 3. Household-deletion-with-ledger-rows cascade test

**The exemption is correct — this is not a finding.** The trigger's cascade
carve-out behaves as the re-review traced, and the test now proves it.

Added at `supabase/tests/20260813_grocery_purchase_history.test.sql:1926-1988`:
an append into a second household's ledger (proving inserts stay legal), a
precondition check that the household about to be deleted really holds ledger
rows, the household delete itself, then assertions that the deleted household's
ledger rows are gone, that the other household's row survived, and that the
surviving household's ledger is still append-only afterwards.

RED-equivalent: the assertion is only meaningful if the cascade carve-out is
what makes the delete succeed, so the trigger was temporarily replaced with an
unconditional raise inside a rolled-back transaction.

```
=== CONTROL: real trigger, household with ledger rows is deletable ===
INSERT 0 1
DELETE 1
 ledger_rows_left
------------------
                0
ROLLBACK

=== MUTATION A: trigger without the cascade exemption ===
CREATE FUNCTION
INSERT 0 1
DELETE ...
ERROR:  grocery purchase occurrences are append-only
CONTEXT:  PL/pgSQL function mobile_grocery_occurrence_ledger_append_only() line 3 at RAISE
SQL statement "DELETE FROM ONLY "public"."household_grocery_purchase_occurrences" WHERE $1 OPERATOR(pg_catalog.=) "household_id""
ROLLBACK
```

Without the exemption, household deletion is blocked outright by the cascade's
own child DELETE — the highest-blast-radius path the re-review flagged. With
the shipped trigger it succeeds and cleans up. The new test fails if that ever
regresses.

### GREEN — full verification

`supabase test db --local`

```
All tests successful.
Files=8, Tests=480,  1 wallclock secs
Result: PASS
```

(474 → 480: six new assertions, all in the cascade section; the two coverage
arrays were extended in place rather than added to.)

`npm test -- --run packages/domain/src/operations.test.ts packages/domain/src/mobileNavigation.test.ts src/test/applicationOperations.test.ts src/test/operationQueue.test.ts`

```
 Test Files  4 passed (4)
      Tests  42 passed (42)
```

`cd mobile && npm test -- --runInBand src/components/mobileNavigation.test.ts src/lib/operations/queue.test.ts src/features/notifications.test.ts`

```
Test Suites: 3 passed, 3 total
Tests:       27 passed, 27 total
```

`npx tsc -b` — exit 0. `cd mobile && npm run typecheck` — exit 0.

`git diff --check` — no output.

## Task 6 regression fix

The Task 6 sweep was right, and the cause is narrower than "grocery needed it".

### What actually happened

Stamping `revision` was **never load-bearing for the grocery/purchase path**. It
was not written for this branch at all. Before `4652c99` there were two
divergent overlay implementations:

- `src/lib/operations/overlay.ts` (web) — no revision stamping, ever.
- `mobile/src/lib/operations/overlay.ts` (native) — stamping, added in
  `b7e4958` "fix(mobile): repair legacy optimistic revisions". Its own test
  names the reason: *"Mobile builds before the revision projection fix stored
  this shape"* — native builds shipped before that fix persisted optimistic
  payloads with no `revision`, and the native SQLite store can still hold them.

`4652c99` merged the two into `packages/application/src/operations/overlay.ts`
and took the native variant wholesale, so a **native storage-format repair got
silently imposed on web**. That is the regression: not a grocery rule leaking,
but a platform migration hack promoted to a shared projection rule.

So the answer to "load-bearing or incidental" is: load-bearing, but for native
only, and for a reason that has nothing to do with entity type. Special-casing
by entity name would have been wrong — the real axis is *which queue's storage
format you are reading*.

### The fix

`packages/application/src/operations/overlay.ts:9-25` replaces the trailing
positional `householdId?: string` with an explicit options object:

```ts
export interface OptimisticOverlayOptions {
  householdId?: string
  repairLegacyRevisions?: boolean   // default false
}
```

The repair is documented in place as a storage-format repair rather than a
projection rule, and it now runs only when asked
(`overlay.ts:67` — `if (repairLegacyRevisions && !isRevision(...))`). The type
is re-exported from `packages/application/src/operations/index.ts:11`.

The two adapters state their own contract, each with a comment saying why:

- `src/lib/operations/overlay.ts:19` — `{ householdId }`; the Dexie queue never
  stored revision-less optimistic payloads and web rows own their revision
  semantics.
- `mobile/src/lib/operations/overlay.ts:19-22` —
  `{ householdId, repairLegacyRevisions: true }`.

Because native opts in at the adapter, every native feature keeps the exact
behavior it had before this branch; `mobile/src/lib/operations/queue.test.ts`
needed only two mechanical signature updates (`:443` opts the direct
`applyOptimisticOverlay` call into the repair it is explicitly testing, `:528`
passes `{ householdId: HOUSEHOLD }` instead of the positional argument). No
native assertion changed.

### A second regression the sweep had not yet reached

`4652c99` also edited **two web assertions** in
`src/test/operationQueue.test.ts` to accommodate the new stamping — the same
class of breakage as the two reported failures, just papered over instead of
surfacing:

```
$ git diff cf0a6d1..HEAD -- src/test/operationQueue.test.ts   # before this fix
-      { id: EVENT_A, title: 'Dentist (moved)', note: 'from partner' },
+      { ... note: 'from partner', revision: 1 },
-    expect(merged).toEqual([{ id: EVENT_A, title: 'Second' }])
+    expect(merged).toEqual([{ id: EVENT_A, title: 'Second', revision: 1 }])
```

Both are reverted to their `cf0a6d1` form (`:572` and `:615`). That diff is
now empty for this file.

`src/test/applicationOperations.test.ts` is a file this branch added, so its
overlay tests were updated to the new signature, and the revision case was
split to pin **both** directions of the contract at `:204-212`: native opt-in
still yields `revision: 1`, and the default leaves the row untouched.

### Also silently affected, but untested

Yes — and worth recording. The stamp only fired when a projected row ended
without a valid revision (`isRevision` requires an integer >= 1), so any web
feature whose mutation already writes `revision` into its optimistic payload
was unaffected: `calendar_event` upserts, `note` upserts, `grocery_item`,
`trip` / `trip_expense` / `trip_itinerary` / `trip_booking`, `ledger_asset`,
`ledger_transfer`, `ledger_schedule`.

The web mutations that do **not** carry a revision in their optimistic payload
were silently receiving a fabricated `revision: 1` on an optimistic create,
with no test to catch it:

- `settings` (`src/features/settings/profile.ts:80` — `optimistic: payload`)
- `ledger_year`, `ledger_category`, `ledger_limit`, `ledger_transaction`
  (`src/features/ledger/statementMutations.ts:37,70,113,151`)

For rows that do have a server row the merge keeps the server's revision, so
the practical exposure was optimistic creates. All five are restored to
pre-branch behavior by this fix. The two reported failures were the visible tip:
a `calendar_event` row shaped `{ id, title }` with no revision concept, and a
Note using `revision: 0` as its "no server row yet" sentinel — which
`isRevision` rejects, so the overlay was overwriting a correct 0 with 1.

### RED

`npm test -- --run src/test/householdRealtime.test.tsx src/test/notesData.test.ts`

```
 FAIL  src/test/householdRealtime.test.tsx > useHouseholdRealtime > a partner's change does not erase this device's unsent edit
AssertionError: expected [ { …(3) } ] to deeply equal [ { …(2) } ]
  [
    {
      "id": "22222222-2222-4222-8222-222222222222",
+     "revision": 1,
      "title": "Mine",
    },
  ]

 FAIL  src/test/notesData.test.ts > useNote > reconstructs a note from the optimistic overlay when it has no server row yet
AssertionError: expected { title: 'Grocery list', …(3) } to deeply equal { …(4) }
    "id": "22222222-2222-4222-8222-222222222222",
-   "revision": 0,
+   "revision": 1,
    "title": "Grocery list",

 Test Files  2 failed (2)
      Tests  2 failed | 5 passed (7)
```

Neither test file was edited.

### GREEN

`npm test -- --run` (full root suite)

```
 Test Files  56 passed (56)
      Tests  264 passed (264)
```

`cd mobile && npm test -- --runInBand`

```
Test Suites: 61 passed, 61 total
Tests:       240 passed, 240 total
```

`cd mobile && npm run typecheck`

```
> mobile@1.0.0 typecheck
> tsc --noEmit
```

`npm run build`

```
PWA v1.3.0
mode      generateSW
precache  108 entries (4575.59 KiB)
files generated
  dist/sw.js
  dist/workbox-9c191d2f.js
```

`supabase test db --local`

```
All tests successful.
Files=8, Tests=480,  2 wallclock secs
Result: PASS
```

`npm run lint`

```
✖ 12 problems (12 errors, 0 warnings)
```

Still exactly the 12 known pre-existing errors, in the same four files:
`mobile/app/(tabs)/index.test.tsx`, `mobile/app/(tabs)/index.tsx`,
`mobile/src/components/AppChrome.tsx`,
`mobile/src/features/settings/MobileNavigationEditor.tsx`.

`npx eslint` over the seven changed files — exit 0.
`git diff --check` — no output.
