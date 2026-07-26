# Native list radius, Statement deletion, and Trip dates design

**Date:** 2026-07-26

**Status:** Approved

## Scope

This correction pass changes three native behaviors:

1. every tappable list item uses the same corner radius as Ledger's
   Statements/Assets segmented bar;
2. Statement deletion works immediately online or offline, including for
   deletion commands already stored on the device;
3. Trip Start and End dates are selected from one calendar-range interface.

The pass does not change the database schema, RPC contract, web client,
authentication, production data, or the larger radius used by summary cards
and forms.

## Shared list-card surface

Add a shared list-card surface that wraps the existing `Card` component and
sets its radius to `tokens.radiusControl`, matching the outer track of the
Ledger Statements/Assets segmented control.

Use this surface for tappable collection rows in:

- Calendar event lists;
- Notification rows;
- Grocery list and Grocery item rows;
- Ledger Statement years, categories, transactions, Assets, one-off
  transfers, and recurring-transfer schedules;
- Note lists;
- Trip lists, itinerary items, bookings, checklist items, and expenses.

The shared `DetailListRow` must use the same surface. Existing interaction
boundaries remain unchanged: tapping the main area opens the item, while
secondary actions and destructive actions remain independent 44-point
targets.

Do not change:

- Calendar month cards;
- annual/monthly Ledger summaries and charts;
- Budget metric cards;
- form fieldsets;
- empty, loading, and error-state cards;
- modal and bottom-sheet surfaces.

Those are content containers rather than list items and keep
`tokens.radiusCard`.

## Statement deletion

### Root cause

`clearYear()` currently stores the year payload as its optimistic state.
Generic overlay processing therefore treats `ledger.year.clear` as an update
and keeps the Statement visible while the command is queued. This differs
from every other destructive command, which uses `optimistic: null`.

Some devices may already contain incorrectly shaped queued
`ledger.year.clear` operations. Correcting only newly created commands would
not repair those pending attempts.

### Correct behavior

- Newly queued `ledger.year.clear` commands use `optimistic: null`.
- Optimistic overlay processing recognizes `ledger.year.clear` as destructive
  even if a legacy queued entry contains a non-null optimistic payload.
- The Statement disappears as soon as the command is durably queued.
- Accepted and duplicate server results keep it removed.
- A conflict or rejection permanently discards the queued command, invalidates
  the affected query, restores the authoritative Statement, and presents the
  server explanation to the user.
- Typed-year confirmation and strict revision validation remain unchanged.
- Existing Ledger child deletion, Asset-posting reversal, and Trip-expense
  detachment remain server-authoritative.

## Trip date range

### Entry field

Replace the side-by-side Start and End controls in `TripSheet` with one
full-width `Trip dates` field. Its collapsed value shows the complete range,
for example:

`Jul 26, 2026 – Jul 27, 2026`

Tapping the field opens a dedicated modal range calendar. This avoids nested
bottom sheets and keeps the main Trip form compact.

### Calendar behavior

- Show one month at a time with previous and next month controls.
- Include weekday headings and outside-month dates using the established
  Calendar geometry and theme tokens.
- New Trips default to today as Start and tomorrow as End.
- Editing a Trip opens with its existing range selected.
- Opening the picker creates a draft range; Cancel leaves the Trip values
  unchanged.
- The first date tap starts a new range and clears the draft End.
- A second tap on the same date creates a one-day Trip.
- A second tap after Start sets End.
- A second tap before Start restarts the range at that date and waits for a
  new End.
- The Start and End dates use visible endpoint circles; dates between them use
  an inclusive range highlight.
- Month navigation supports ranges that cross month and year boundaries.
- Done is disabled until both endpoints exist. Done commits the draft range
  and closes the picker.

Date-only values continue to serialize as local calendar keys
(`YYYY-MM-DD`) without UTC conversion. The existing server validation that
End cannot precede Start remains in place.

## Component boundaries

- `ListCard` owns list-row surface styling only.
- `DetailListRow` retains navigation and action semantics and delegates its
  surface to `ListCard`.
- `TripDateRangeField` owns the collapsed range control and modal visibility.
- `TripDateRangeCalendar` owns month-grid generation, draft range selection,
  and range highlighting.
- Pure date-range helpers own default-range creation, date comparison,
  month navigation, and tap-state transitions.
- `TripSheet` owns committed form values and Trip operation submission.

These boundaries keep the range logic independently testable and prevent a
Trip-specific workflow from changing Calendar events or other date fields.

## Error handling

- Statement deletion retains the shared operation lifecycle: one submission
  at a time, close only after an accepted queue outcome, and render conflicts
  or exceptions without an unhandled promise rejection.
- The Trip range picker cannot commit an incomplete range.
- Trip saving retains the End-on-or-after-Start validation as defense in
  depth.
- Closing the Trip form while the range picker is open discards the range
  draft.

## Testing

Add failing tests before production changes for:

- a new `ledger.year.clear` command storing `optimistic: null`;
- a legacy queued clear operation removing the Statement from the optimistic
  overlay;
- other non-destructive optimistic operations remaining unaffected;
- all shared list rows rendering with `tokens.radiusControl`;
- the Trip range defaulting to today/tomorrow;
- first-tap, same-day, forward-range, earlier-date restart, Cancel, and Done
  behavior;
- cross-month navigation and inclusive range membership;
- editing a Trip opening with its saved range;
- `TripSheet` submitting the selected Start and End date keys.

After focused tests pass, run the full native Jest suite, native TypeScript,
repository lint, production web build, and scoped `git diff --check`.

## Manual acceptance

On an iPhone simulator or physical device:

1. confirm list cards share the Ledger segmented-bar radius without changing
   summary-card geometry;
2. delete a Statement while online and confirm it disappears;
3. queue a Statement deletion while offline and confirm it disappears
   immediately and stays removed after reconnect;
4. create same-day, multi-day, and cross-month Trips from the single range
   calendar;
5. cancel a draft range and confirm the previous dates remain unchanged.
