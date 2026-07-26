# Native Header and Spacing Refinement

**Date:** 2026-07-26

**Status:** Implemented and verified

## Scope

Refine three native layout details before publishing the mobile-first branch:

1. balance the Calendar month/year header spacing;
2. make the collapsed Budget month selector visually thinner;
3. move detail-screen back navigation into the shared application header.

This pass does not change domain behavior, routes, persistence, server
operations, web behavior, or production configuration.

## Calendar month header

The Calendar card keeps its current month navigation, weekday row, and date
grid. The month/year row receives the same 14-point bottom spacing as the
card's outer inset, producing balanced space above and below the row before
the weekday labels begin.

Date-cell geometry, event-dot positioning, today's circular marker, and
48-point week-row height remain unchanged.

## Compact Budget month selector

The collapsed selector remains a three-part control:

- previous-month button;
- tappable month label that expands the twelve-month grid;
- next-month button.

The control retains 44-point minimum tap targets. Visual density is reduced by
using a 48-point collapsed card, smaller outer padding, 18-point chevrons, and
a 16-point month label. The expanded month grid and January/December boundary
behavior remain unchanged.

## Shared detail back navigation

`AppHeader` becomes the single owner of detail-screen back navigation.

- Grocery list detail shows an icon-only back button targeting Groceries.
- Budget detail shows an icon-only back button targeting Ledger.
- Note detail shows an icon-only back button targeting Notes.
- Trip detail shows an icon-only back button targeting Trips.

The button is a circular 36-point surface with a chevron-left icon and an
accessible label. It occupies the upper-left header position on detail routes,
aligned with the centered page title and the Notification and Settings
buttons. Root routes retain an empty left-side spacer so title centering
remains stable.

The existing text controls such as `All lists`, `Ledger`, `All notes`, and
`All trips` are removed from page content. The shared header uses explicit
route-to-parent mapping and `router.replace` so returning from a detail screen
always reaches its owning tab, including when the detail route was opened
through a deep link.

Notification and Settings screens are outside the tab shell and are not
changed by this pass.

## Accessibility

- The back button exposes a route-specific label such as `Back to Groceries`.
- All header and Budget navigation controls retain at least 44-point effective
  touch targets through their surface or hit slop.
- Disabled January/December arrows preserve their existing accessibility
  state.
- Title centering remains independent of left and right action widths.

## Tests and verification

Test-first coverage will verify:

- detail paths resolve to the correct parent route and accessible back label;
- root paths do not show a back action;
- pressing the header back button replaces the route with its parent;
- the Budget selector retains 44-point tap targets while using the compact
  visual dimensions;
- Calendar month-header spacing matches the card inset.

After focused tests pass, run native Jest, native TypeScript, repository
ESLint, the web production build, Expo Doctor, and iOS/Android production
exports. Physical-device visual acceptance remains part of Task 9.
