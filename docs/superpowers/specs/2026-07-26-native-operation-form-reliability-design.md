# Native Operation and Form Reliability Design

## Goal

Eliminate the native `baseRevision ... got undefined` crash, preserve pending offline work created by older builds, and make every operation-backed form close or display an actionable error consistently.

## Root Cause

The durable SQLite operation queue may contain optimistic records created before revision fields were added to the mobile mutation payloads. When those records are layered over server reads, an optimistic-only entity can have no `revision`. The current persisted React Query cache uses the unchanged `mobile-v1` buster, so an incompatible cached entity may also survive an app update. Delete and edit handlers pass that missing value to the queue boundary, which correctly rejects it.

Several screens await mutation functions directly without catching queue errors or checking discarded server outcomes. Those rejected promises reach the React Native error overlay, and the code that closes the sheet or confirmation dialog never runs.

## Data Compatibility

- Preserve the durable operation queue and its FIFO ordering.
- When applying a legacy optimistic upsert that lacks a valid revision, derive the projected revision from `command.baseRevision`, or use revision `1` for a queued create.
- Do not weaken the queue boundary. New invalid commands must still be rejected.
- Change the persisted-query buster from `mobile-v1` to `mobile-v2` so incompatible hydrated query rows are discarded and rebuilt from Supabase plus the repaired durable overlay.
- Do not clear sessions, pending operations, discarded-operation history, or manually entered data.

## Form Lifecycle

Every Calendar, Grocery, Ledger, Note, and Trip operation-backed form follows one lifecycle:

1. Disable repeated submission while the operation is running.
2. Clear any previous error.
3. Await the operation.
4. For `queued` or successful `settled` outcomes, close the form or confirmation.
5. For `discarded` outcomes, keep the owning form open and show the server explanation.
6. For thrown validation or transport errors, keep the form open and show a user-facing message instead of allowing an unhandled rejection.
7. Re-enable submission in `finally`.

Confirmation dialogs accept an optional error message so failed destructive actions remain visible and retryable without closing the modal.

## Duplicate Delete Controls

- Grocery list deletion remains on the list-index trash icon. Remove the Grocery detail header Delete text control.
- Grocery item deletion remains on each item-row trash icon. Remove the Item edit-sheet Delete text control and its nested confirmation.
- Note deletion remains on the Notes index trash icon. Remove the Note detail Delete text control and its confirmation.
- Keep statement, trip, calendar-event, ledger-transaction, category, asset, itinerary, booking, checklist, and expense deletion controls because they do not have equivalent duplicate controls in the same workflow.

## Verification

- Unit-test legacy optimistic records without revision and confirm they project a valid revision.
- Unit-test the new persisted-query buster contract.
- Unit-test user-facing operation error normalization and confirmation-dialog error rendering.
- Component-test that the duplicate Grocery and Note Delete text controls are absent while authoritative trash actions remain.
- Run focused native tests, complete native Jest, native TypeScript checking, and workspace lint/typecheck where available.

