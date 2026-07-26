# Native Operation and Form Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair legacy revision-less optimistic records and make all native operation-backed forms close or report failures consistently without unhandled promise errors.

**Architecture:** Keep strict command validation at the queue boundary, repair legacy data while projecting the durable queue, and invalidate only incompatible React Query snapshots. Use shared error formatting plus a ConfirmDialog error surface while retaining local busy/error state in each form.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, TanStack Query persistence, Expo SQLite, Jest, React Native Testing Library, TypeScript.

## Global Constraints

- Preserve all pending SQLite operations, FIFO sequence values, user sessions, and application data.
- Keep queue boundary validation strict.
- Accepted `queued` and `settled` outcomes close forms; `discarded` and thrown failures remain visible.
- Do not stage or modify the user’s unrelated reference and handoff files.
- Grocery and Note index trash icons remain the authoritative top-level delete actions.

---

### Task 1: Legacy Revision Compatibility

**Files:**
- Modify: `mobile/src/lib/operations/overlay.ts`
- Modify: `mobile/src/lib/operations/queue.test.ts`
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/src/lib/queryPersister.test.ts`

**Interfaces:**
- Consumes: `QueuedOperation.command.baseRevision` and `QueuedOperation.optimistic`.
- Produces: projected optimistic rows with a valid `revision`, plus persisted-query buster `mobile-v2`.

- [ ] **Step 1: Write failing overlay and cache-version tests**

Add a queue-overlay test using a legacy queued create whose optimistic payload has no `revision`; assert the projected row has revision `1`. Add a cache contract assertion for `mobile-v2`.

- [ ] **Step 2: Run focused tests and verify the legacy overlay test fails**

Run: `npm --prefix mobile test -- --runInBand src/lib/operations/queue.test.ts src/lib/queryPersister.test.ts`

Expected: the legacy projected row has no revision and the cache contract still reports `mobile-v1`.

- [ ] **Step 3: Repair projection and bump the cache buster**

When the merged optimistic row lacks a valid revision, assign `operation.command.baseRevision ?? 1`. Export one `MOBILE_QUERY_CACHE_BUSTER` constant and use it in the root provider and persistence test.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm --prefix mobile test -- --runInBand src/lib/operations/queue.test.ts src/lib/queryPersister.test.ts`

Expected: PASS.

### Task 2: Shared Failure Presentation

**Files:**
- Modify: `mobile/src/lib/operations/outcome.ts`
- Modify: `mobile/src/lib/operations/index.ts`
- Create: `mobile/src/lib/operations/outcome.test.ts`
- Modify: `mobile/src/components/ConfirmDialog.tsx`
- Modify: `mobile/src/components/ConfirmDialog.test.tsx`

**Interfaces:**
- Produces: `operationThrownError(error: unknown, fallback: string): string`.
- Produces: optional `ConfirmDialog.error?: string | null`.

- [ ] **Step 1: Write failing helper and dialog tests**

Test that queue validation errors become a synchronization message, ordinary `Error` messages remain readable, unknown errors use the fallback, and the dialog renders an optional error.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm --prefix mobile test -- --runInBand src/lib/operations/outcome.test.ts src/components/ConfirmDialog.test.tsx`

Expected: FAIL because the helper and dialog error property do not exist.

- [ ] **Step 3: Implement the helper and dialog error surface**

Map missing/invalid revision messages to “This item is out of date. Refresh it and try again.” Render the optional dialog error below its description using the danger token.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm --prefix mobile test -- --runInBand src/lib/operations/outcome.test.ts src/components/ConfirmDialog.test.tsx`

Expected: PASS.

### Task 3: Root Lists and Duplicate Controls

**Files:**
- Modify: `mobile/app/(tabs)/groceries/index.tsx`
- Modify: `mobile/app/(tabs)/notes/index.tsx`
- Modify: `mobile/app/(tabs)/trips/index.tsx`
- Modify: `mobile/app/(tabs)/groceries/[listId].tsx`
- Modify: `mobile/src/features/groceries/ItemSheet.tsx`
- Modify: `mobile/app/(tabs)/notes/[noteId].tsx`
- Create or modify focused component tests under `mobile/src/features/groceries/` and `mobile/src/features/notes/`.

**Interfaces:**
- Consumes: `operationOutcomeError`, `operationThrownError`, and `ConfirmDialog.error`.
- Produces: retryable list deletion confirmations and accepted create forms that close.

- [ ] **Step 1: Write failing lifecycle and duplicate-control tests**

Cover successful root deletion closure, failed root deletion error display, and absence of redundant Grocery/Note detail Delete text controls.

- [ ] **Step 2: Run focused tests and verify failure**

Run the new root/detail screen tests with `npm --prefix mobile test -- --runInBand`.

Expected: FAIL against current uncaught handlers and duplicate controls.

- [ ] **Step 3: Implement root lifecycle handling and remove duplicate controls**

Add busy/error state, check operation outcomes, catch thrown errors, and close only accepted operations. Remove Grocery detail/list and item-sheet duplicate Delete controls and Note detail Delete control.

- [ ] **Step 4: Run focused tests and verify they pass**

Run the same focused files.

Expected: PASS.

### Task 4: Remaining Native Operation Forms

**Files:**
- Modify operation-backed forms in `mobile/src/features/calendar/`
- Modify operation-backed forms in `mobile/src/features/groceries/`
- Modify operation-backed forms in `mobile/src/features/ledger/`
- Modify operation-backed forms in `mobile/src/features/trips/`
- Modify affected focused tests.

**Interfaces:**
- Consumes: shared operation outcome and thrown-error helpers.
- Produces: consistent close/error/busy behavior across every native operation form.

- [ ] **Step 1: Add failing tests for uncovered mutation forms**

Prioritize Grocery item editing, Ledger year clearing, transfer creation/deletion, and transaction deletion because they currently bypass either outcome or thrown-error handling.

- [ ] **Step 2: Run the focused tests and verify failure**

Run only the affected suites with `npm --prefix mobile test -- --runInBand`.

Expected: FAIL for uncaught/discarded lifecycle paths.

- [ ] **Step 3: Apply the lifecycle pattern to every audited handler**

For each handler: set busy, clear error, await, check outcome, close on acceptance, keep open and render the failure on discard/throw, and clear busy in `finally`.

- [ ] **Step 4: Run focused tests and verify they pass**

Run the same affected suites.

Expected: PASS.

### Task 5: Full Verification and Handoff

**Files:**
- Modify: `progress.md`
- Modify: `docs/superpowers/progress-detail.md` only if the completed-work archive requires it.

**Interfaces:**
- Produces: verified correction record and Git-ready branch.

- [ ] **Step 1: Run native tests**

Run: `npm --prefix mobile test -- --runInBand`

Expected: all suites pass.

- [ ] **Step 2: Run native typecheck**

Run: `npm --prefix mobile run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run relevant workspace verification**

Run the repository lint/typecheck commands documented in the root package scripts.

Expected: exit code 0, or record an external environment blocker with exact output.

- [ ] **Step 4: Review the final diff**

Confirm no unrelated reference files are staged and no user data reset was introduced.

- [ ] **Step 5: Update progress documentation**

Record the root cause, changed lifecycle contract, files, tests, and any remaining manual device checks.
