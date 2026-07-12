# Design: trip period + itinerary day dropdown, grocery price-on-add + ordering

Date: 2026-07-12
Status: approved (design), pending implementation
Branch: phase-1-pages-notes

Two independent refinements. Decisions confirmed with the user: trip period is
**editable anytime**; grocery price on add is **optional**.

---

## T1 — Trip period + itinerary day dropdown

**Goal.** Pick a trip's date range when creating the page; itinerary items then
choose their date from a dropdown of days within that range.

**Schema.** Add nullable `start_date date` and `end_date date` to `pages`
(check `end_date is null or start_date is null or end_date >= start_date`).
Only trip pages use them; `usePage` already selects `*`, so they load with the
page. Regenerate types.

**Create.** `useCreatePage` accepts optional `startDate`/`endDate` and includes
them in the insert. `TemplatePicker`: when the selected template is `trip`, show
optional Start/End date inputs; validate end ≥ start.

**Edit anytime.** New `useUpdatePageDates` (updates start/end on a page,
caches the returned row on `['page', id]`, invalidates `['pages', section]` —
same shape as `useRenamePage`). `TripPageView` header shows the range
("Aug 1 – Aug 7", or "Set dates" when unset) as a button opening a small
`TripDatesDialog` (Start/End inputs, end ≥ start, clearable). Realtime already
covers `pages`.

**Itinerary date dropdown.** `ItineraryDialog` receives the trip's
`startDate`/`endDate`. When both are set, the Date field is a `<select>` whose
options are each day from start to end (value `yyyy-MM-dd`, label "Sat, Aug 2").
Fallbacks: when no period is set, keep the current `<input type="date">`; when
editing an item whose date falls outside the range, include that date as an
extra option so it's preserved. Default selection: the item's current date, else
the trip start.

**Tests.** Migration/type regen; `useCreatePage` with dates; `useUpdatePageDates`;
a helper `daysInRange(start, end)` unit-tested; `TripPageView` shows the range +
opens the dialog; `ItineraryDialog` renders a day dropdown within the period and
falls back without one. Live: create a trip with a period, confirm it persists,
edit it, add an itinerary item constrained to the period, cross-account read.

---

## T2 — Grocery price-on-add + newest-first ordering

**Goal.** Enter a price alongside the name when adding an item; new items appear
at the top of the list.

**Price on add.** `useCreateGroceryItem` gains an optional `lastPrice`; when
present it's included in the create upsert payload (and the optimistic row), so
the DB insert carries `last_price` and the existing `record_grocery_price_history`
trigger records the price. `GroceryPageView` add box gets a small optional price
input next to the name; parse/validate like the edit dialog (blank = no price).
No schema change.

**Newest-first.** Change `useGroceryItems` ordering to `created_at desc, id desc`
so the most recently added item sorts first; optimistic inserts prepend to the
cache (`[optimistic, ...old]`). `sort_order` stays on the row (still assigned)
but no longer drives display order — there is no manual reordering UI.

**Tests.** `useGroceryItems` new order; `useCreateGroceryItem` includes
`last_price` when given and prepends optimistically; `GroceryPageView` add-with-
price flow. Live: add "Milk" with a price in one call → item shows the price and
a history row exists; a second added item sorts above the first.

---

## Cross-cutting

Per feature: tests, lint, tsc, build; T1 also `supabase db reset` + `db lint` +
reseed + a live script. Independent commits, T1 then T2.
