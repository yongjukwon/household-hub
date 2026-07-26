# Mobile UI Correction Design

**Date:** 2026-07-26
**Status:** Approved, with Schedule clarification
**Scope:** Native Household Hub correction pass before Task 9

## Goals

- Improve vertical alignment and density without changing the five-tab information architecture.
- Make root list interactions consistent across Groceries, Ledger Statements, Notes, and Trips.
- Restore the intended Budget month-navigation pattern.
- Repair Ledger category creation and replace unexplained disabled transaction actions with an actionable prerequisite flow.
- Preserve the authoritative operation queue, offline behavior, and existing Supabase contracts.

## Non-goals

- No Home destination.
- No change to the required Asset linkage for Ledger income or spending.
- No new report action on Groceries, Notes, or Trips.
- No change to year-deletion server behavior or its typed-year confirmation.
- No Task 9 data reset or production cutover.

## Header

`AppHeader` will geometrically center the current page title against the full screen, independent of the notification and Settings buttons on the right.

- Root titles remain Schedule, Groceries, Ledger, Notes, and Trips.
- The Ledger year detail route displays `Budget`.
- Notification and Settings remain the only persistent header actions.
- Centering must not depend on the width of the right-side action group.

## Schedule Calendar

Every day cell uses a stable internal layout:

- The date number occupies the same fixed, vertically and horizontally centered position.
- An event dot is positioned independently and never changes the number's alignment.
- Only today's date receives a visible circular outline.
- The today outline uses equal width and height with a 50% radius, so it is a perfect circle.
- Selected dates retain the accent selection treatment.
- If today is selected, the selected treatment takes precedence while preserving circular geometry and centered content.
- Dates other than today do not display a circle.

## Root List Pattern

Groceries, Notes, Trips, and Ledger Statements use the same row structure:

1. A main content press target fills the available row width and opens the detail screen.
2. A separate trash button sits at the right edge.
3. The trash action opens a destructive confirmation and does not trigger row navigation.
4. Chevron icons are removed.

Ledger Statement rows additionally include a graph/report button between the main press target and trash button. It expands or collapses the annual report without opening Budget.

Deletion behavior:

- Grocery list deletion uses the existing list-delete operation and clearly states that its items are also removed.
- Note deletion uses the existing note-delete operation.
- Trip deletion uses the existing trip-delete operation and retains the server's related-record rules.
- Statement deletion opens the existing typed-year confirmation and clears only that Ledger year.

## Ledger Statement Index

- Replace the inline `+ Year` text control with the shared bottom-right floating `+` button.
- The button is visible while the Statements segment is active.
- The existing year-selection sheet remains the creation workflow.
- Already-created years remain disabled in the selector.
- Main row taps open the corresponding Budget page.
- Graph and deletion actions remain independent sibling controls.

## Budget Detail

The page header title is `Budget`.

The content removes:

- the duplicate `Budget <year>` heading;
- the `Clear year` action.

The compact back control remains available to return to Ledger.

### Month navigation

The default state is a single compact month navigator:

```text
‹                 July                 ›
```

- Previous is disabled in January.
- Next is disabled in December.
- Tapping the centered month label expands the complete 12-month grid.
- Selecting a month in the grid updates the active month and collapses the grid.
- The year never changes through these arrows.
- The expanded grid matches the approved four-column, three-row reference.

## Ledger Categories

Category creation is not intended to fail. The current flow has two client-side defects:

- optimistic category and limit records are not represented in the Budget read model;
- operation failures can be ignored while the form closes.

The correction will:

- reconcile queued category and limit operations into the active month's optimistic read model;
- keep propagated server behavior from the selected month through December;
- wait for and inspect both category and limit operation outcomes;
- keep the form open and display a clear error if either operation is rejected;
- refresh affected Ledger queries after successful or duplicate outcomes.

## Income and Spending Prerequisites

Every income or spending transaction must remain linked to an Asset. This is a locked domain rule because the transaction and Asset posting are applied atomically.

The transaction actions will no longer appear silently disabled:

- `+ Income` and `+ Spending` remain pressable.
- If no compatible CAD Asset exists, pressing either action shows a concise explanation and a `Create Asset` action.
- `Create Asset` switches to the Assets segment and opens the new-Asset form.
- After Asset creation, the user can return to the original transaction workflow without losing the intended transaction type.
- Missing categories are explained within the transaction flow and link to category creation where appropriate.
- Server operation failures and negative-balance warnings continue to use the shared operation-outcome handling.

## Component Boundaries

- `AppHeader` owns route-to-title mapping and screen-centered title layout.
- Calendar day rendering gains a fixed date surface and independently positioned dot.
- Ledger root owns the segment-aware floating action button and new-year sheet.
- `StatementsTab` becomes presentation-focused and receives creation callbacks from Ledger root.
- `StatementYearList` owns independent main, report, and delete controls.
- The typed-year deletion sheet moves from Budget detail to the Statement list.
- A reusable destructive-confirmation sheet supports Grocery, Note, and Trip root lists.
- `AssetsTab` accepts an external request to open its creation sheet.
- Budget month selection becomes a small dedicated component with collapsed and expanded states.

## Accessibility

- Every icon-only action has a specific accessibility label.
- Disabled month arrows expose disabled state.
- Row main actions and row deletion actions are separate accessible controls.
- Destructive confirmations name the exact entity being deleted.
- Calendar day selection and today state remain available through accessible labels and state.

## Verification

Focused tests will cover:

- page-title centering and the `Budget` route title;
- Calendar number alignment with and without event dots;
- today-only circular outline geometry;
- Statement FAB visibility by segment;
- independent Statement row navigation, report, and delete actions;
- typed-year deletion from the Statement index;
- collapsed month navigation, boundary disabling, expansion, selection, and collapse;
- optimistic category/limit visibility and rejected-operation errors;
- Asset-prerequisite handoff for income and spending;
- independent row navigation and deletion for Groceries, Notes, and Trips.

The full native suite will then run:

- formatting and diff checks;
- TypeScript typecheck;
- ESLint;
- Jest;
- Expo iOS and Android export validation.
