# Task 3 Report: Grocery Purchase Entry and Inline Price History

## Status

DONE

## Implementation

- Completed the interrupted mobile purchase flow: priced items check immediately; unpriced items require purchase entry or the explicit no-history path.
- Serialized `Don't show this warning again` profile persistence before the unpriced check, retained the warning on save failure, and skipped only the confirmation when already suppressed.
- Kept purchase sheets open on rejected operations, showed errors in the active modal, and disabled repeat submission while pending.
- Preserved decimal quantity and total-paid values, calculated unit price from total/quantity, and ranked canonical history using the exact ratio before display rounding.
- Kept one inline history panel directly below its item, with stable list keys and quantity, total, store snapshot, and purchase date metadata.
- Added decimal keyboard input for Item Sheet quantity.

## Files

- `mobile/app/(tabs)/groceries/[listId].tsx`
- `mobile/src/features/groceries/ItemSheet.tsx`
- `mobile/src/features/groceries/PurchasePrompt.tsx`
- `mobile/src/features/groceries/data.ts`
- `mobile/src/features/groceries/data.test.ts`
- `mobile/src/features/groceries/GroceryPurchaseFlow.test.tsx`
- `mobile/src/features/groceries/ItemSheet.test.tsx`
- `mobile/src/features/groceries/PurchasePrompt.test.tsx`

## TDD RED/GREEN

- RED: `GroceryPurchaseFlow.test.tsx` proved the item was checked before suppression persistence resolved and that rejected purchase/profile operations escaped without visible recovery.
- RED: `data.test.ts` proved ranking used rounded legacy unit cents instead of the exact total/quantity ratio.
- GREEN: focused grocery suite passed: 6 suites, 22 tests.
- GREEN after exact-ratio regression: `data.test.ts` + `GroceryPurchaseFlow.test.tsx`, 15 tests.

## Verification

- `cd mobile && npm test -- --runInBand`: 59 suites passed, 213 tests passed.
- `cd mobile && npm run typecheck`: exit 0.
- `git diff --check`: exit 0.

## Self-review

- Checked every Task 3 brief bullet against an observable test: name-only add; edit preservation/validation; priced/unpriced checking; suppression sequencing/failure; inline single-panel placement; history metadata; exact-ratio ranking.
- Preserved AppChrome, notification behavior, web code, and Task 4's ownership of final database/server rules.

## Concerns

- The full suite still emits existing overlapping `act()` warnings from two auth test files; all suites pass and Task 3 tests are warning-free.
- Final server-side purchase-history insertion, deduplication, and migration remain Task 4 scope.

## Fix Round 1

- Reproduced negative-price acceptance in both `PurchasePrompt` and `ItemSheet`: the shared money parser removes a minus sign before conversion. Added grocery-entry raw-sign validation without changing shared parser behavior used by balances elsewhere.
- Reproduced duplicate priced-item checkbox submission with a deferred toggle promise. Added a per-item synchronous ref guard plus rendered pending state; the checkbox is disabled until its mutation settles.
- Strengthened exact-ratio ranking with six sub-cent unit-price ratios that all retain the same legacy rounded-cent value.
- RED command: `npm test -- --runInBand src/features/groceries/PurchasePrompt.test.tsx src/features/groceries/ItemSheet.test.tsx src/features/groceries/GroceryPurchaseFlow.test.tsx -t 'negative raw|while its toggle is pending'` -> 3 suites failed, 3 tests failed.
- GREEN regression command: `npm test -- --runInBand src/features/groceries/PurchasePrompt.test.tsx src/features/groceries/ItemSheet.test.tsx src/features/groceries/GroceryPurchaseFlow.test.tsx src/features/groceries/data.test.ts -t 'negative raw|while its toggle is pending|exact total-to-quantity ratio'` -> 4 suites passed, 4 tests passed, 19 skipped.
- Covering focused command: `npm test -- --runInBand src/features/groceries/PurchasePrompt.test.tsx src/features/groceries/ItemSheet.test.tsx src/features/groceries/GroceryPurchaseFlow.test.tsx src/features/groceries/data.test.ts src/features/groceries/GroceryDeletionControls.test.tsx src/features/groceries/GroceryItemActions.test.tsx` -> 6 suites passed, 26 tests passed.
- `npm run typecheck` -> exit 0; `git diff --check` -> exit 0.
