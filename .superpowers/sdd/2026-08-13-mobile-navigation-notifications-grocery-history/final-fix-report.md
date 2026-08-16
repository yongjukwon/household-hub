# Final-review fix wave report

Status: **COMPLETE**

Fix base: `af57f61`

Scope: the five findings in `final-review-findings.md`. The approved plan and
progress ledger were not changed.

## Findings closed

1. **Expo production route contamination** — moved the Calendar screen test
   from `mobile/app/(tabs)` to `mobile/src/features/calendar`, retained its
   assertions, and updated its import. `npx expo export --platform ios` now
   completes successfully.
2. **Settings cache projection** — durable `settings.update` commands now
   project immediately into the exact `['profile', userId]` query. Pending
   commands are reapplied after persisted-query restoration, and the exact
   profile query is invalidated only when the queued command settles or is
   discarded. Removed screen-level refetches that could overwrite queued
   offline state before settlement.
3. **Grocery cache projection** — durable item upserts/deletes now update
   already-fetched list-detail caches directly using the shared optimistic
   overlay. Purchase writes also project derived item history and the
   household purchase-history cache. Pending operations replay in local
   sequence after cache restoration, preserving add/check/remove/purchase
   visibility across offline relaunch.
4. **Lint gate** — fixed the 12 branch-created errors: test mocks use
   `jest.requireActual`, App Chrome contexts/hooks and provider are split into
   Fast Refresh-safe modules, navigation draft reset is keyed rather than
   effect-driven, and the Calendar route synchronization has a narrow
   documented lint exception.
5. **Internal-table RLS documentation** — added forward migration comments for
   `calendar_event_deletion_snapshots` and
   `household_grocery_purchase_occurrences`, explicitly documenting their
   household-scoped, server-only, deny-all RLS/revoked-grant exception. Added
   pgTAP coverage for both comments; no client policy was added.

## TDD evidence

### Query-cache and offline persistence

RED — the new real queue/QueryClient/persister integration suite failed all
three behaviors before production changes:

- navigation and warning suppression remained unchanged in the profile cache;
- the exact profile query was not invalidated after online settlement;
- Grocery item/history caches remained stale.

During spec re-review, the integration test was strengthened to start without a
preseeded household history query and to assert add, check, purchase, and remove
independently. That produced a further RED: the household history cache was
`undefined` after the purchase.

GREEN — `mobile/src/lib/operations/cacheProjection.integration.test.ts` now
passes with the real durable queue, TanStack QueryClient, query-cache persister,
and restore flow. Only network, Supabase transport, and secure-storage
boundaries are mocked. The focused mobile run finished with 3 suites / 22 tests
passing.

### Lint

RED — `npm run lint` reported the 12 errors listed in the final-review finding.

GREEN — `npm run lint` exits clean without changing lint configuration.

### Internal-table documentation

RED — the new pgTAP file failed 2/2 assertions because both table comments
were `NULL`.

GREEN — after applying the forward migration locally, the full database suite
passes 482/482 assertions.

## Final verification

| Area | Command | Result |
|---|---|---|
| Mobile | `npm test -- --runInBand` | PASS — 62 suites, 248 tests |
| Mobile | `npm run typecheck` | PASS |
| Mobile | `npx expo export --platform ios` | PASS — iOS bundle exported |
| Root | `npm test -- --run` | PASS — 56 files, 267 tests |
| Root | `npm run build` | PASS — TypeScript build and Vite production build |
| Repository | `npm run lint` | PASS |
| Edge functions | `npm run test:functions` | PASS — 73/73 |
| Database | `supabase test db --local` | PASS — 9 files, 482 assertions |
| Patch | `git diff --check` | PASS |

The functions test transiently added two already-declared Expo dependencies to
`deno.lock`; that unrelated generated change was removed before commit.

## Self-review

- Reviewed the complete `af57f61..HEAD` fix-wave diff against all five
  findings.
- Standards re-review found no actionable hard violation after Grocery item
  merge/delete projection was delegated to the shared
  `applyOptimisticOverlay` seam. The forward comment migration is required to
  upgrade environments where the phase migrations are already applied.
- Spec re-review found no remaining actionable gap after removing premature
  profile refetches, seeding an uncached household purchase-history query, and
  separating Grocery add/check/purchase/remove integration assertions.
- Web behavior, the shared 65,351-case overlay contract, and server operation
  contracts were not changed.

## Non-blocking observations

- Existing overlapping `act()` warnings remain in the mobile auth tests; all
  tests pass.
- The root production build retains its existing large-chunk advisory; the
  build exits successfully.
- Physical-device exploratory QA is not part of this automated fix wave.
