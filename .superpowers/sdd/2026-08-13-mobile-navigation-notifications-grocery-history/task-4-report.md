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
