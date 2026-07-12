# Design: per-month budgets, inline title editing, global grocery knowledge

Date: 2026-07-12
Status: approved (design), pending implementation
Branch: phase-1-pages-notes

Three independent refinements from the user, each shippable as its own tested,
live-verified commit. Decisions were settled with the user before this spec.

---

## F1 — Per-month budget limits (carry-forward)

**Problem.** `budget_categories.monthly_limit` is a single value applied to every
month, so a category's budget can't differ month to month.

**Model.** Categories stay global (the same category list every month); only the
*limit* becomes month-aware.

- New table `budget_category_limits`:
  - `id uuid pk`, `household_id uuid` (trigger-derived from page), `page_id uuid`,
    `category_id uuid`, `month text check (^\d{4}-(0[1-9]|1[0-2])$)`,
    `amount numeric(10,2) not null check (amount >= 0)`, `created_at`, `updated_at`.
  - `unique (category_id, month)`.
  - Composite FK `(category_id, page_id, household_id)` →
    `budget_categories(id, page_id, household_id)` on delete cascade (mirrors
    `budget_entries`, prevents cross-page/tenant pairing).
  - Household trigger reuses `set_budget_household_id_from_page()`; `updated_at`
    trigger; RLS `is_household_member(household_id)`; index on
    `(category_id, month)`.
- **Effective limit for (category, month)** = the `amount` of the row with the
  greatest `month' <= month`; if none, fall back to the category's existing
  `monthly_limit`. This is "carry forward until changed" and is backward
  compatible — categories with no limit rows behave exactly as today.
- `budget_categories.monthly_limit` is **kept** as the baseline/fallback (no data
  migration needed).

**Data layer (`useBudget.ts`).**
- New query `useBudgetCategoryLimits(pageId)` → all limit rows for the page
  (small set), key `['budget', pageId, 'limits']`.
- Helper `effectiveLimit(category, limits, month)` implementing the rule above.
- Mutation `useSetBudgetCategoryLimit` → upsert on `(category_id, month)` with a
  client UUID; invalidates the limits query. (`onConflict: 'category_id,month'`.)
- Realtime: subscribe `budget_category_limits` by `page_id` in `BudgetPageView`.

**UI (`BudgetPageView` / `BudgetDialogs`).**
- Category card, chart, and totals use `effectiveLimit(category, limits, month)`
  for the selected month instead of `category.monthly_limit`.
- **Create** a category (dialog opened while viewing month M): sets the
  category's baseline `monthly_limit = L`. No override row — the baseline applies
  to every month until you diverge one, which keeps creation simple.
- **Edit** a category's limit while viewing month M: writes/updates the
  `budget_category_limits` override row for **M** (leaving `monthly_limit`
  untouched). A short hint notes the change applies from month M onward. The
  card/chart/totals for M then reflect the effective limit.

**Tests.** `effectiveLimit` unit tests (carry-forward, fallback, exact match);
hook tests for the limits query + set mutation; a `BudgetPageView` test that two
months show different effective limits. **Live**: set a limit in July, confirm
August inherits it, override August, confirm July unchanged; cross-account read.

---

## F2 — Inline editable page title (replaces Rename)

**Problem.** Titles are only editable via a "Rename" menu item; the user wants to
click the title in the page and edit it directly.

**Change.**
- New shared `src/components/pages/EditableTitle.tsx`: renders the title as an
  `<h1>`-styled button; click → controlled `<input>` with the same typography;
  Enter/blur saves via `useRenamePage`, Escape cancels, blank rejected (reverts).
  Pending/disabled while saving; error reverts with a console log.
- Wire it into all four page headers: `NotesPageView`, `BudgetPageView`,
  `TripPageView`, `GroceryPageView` (replace the static `<h1>{page.title}</h1>`).
- **Remove** the "Rename" item from `PageCard` (leave Delete) and **delete**
  `RenamePageDialog.tsx` and its test. `useRenamePage` stays (now used by
  `EditableTitle`).

**Tests.** `EditableTitle`: click-to-edit, save on Enter, cancel on Escape,
reject blank. Update `PageCard.test.tsx` to assert Rename is gone. Existing
`useRenamePage` hook test stays.

---

## F3 — Global grocery autocomplete + global price history

**Problem.** Price history and (desired) name autocomplete are per-store-page; the
user wants both to span all their grocery pages so an item's prices and name are
known household-wide.

**Schema.** Add `item_name text` (display casing) to `grocery_price_history`,
populated by the existing `record_grocery_price_history()` trigger from the
item's `new.name`. Lets history and suggestions show proper casing and stay
durable. (Existing rows keep only the normalized name; dev data, no backfill
required.)

**Global price history.**
- `useGroceryPriceHistory` gains a household-wide mode keyed by normalized name
  (not `page_id`), selecting `price, recorded_at, item_name, pages(title)` so each
  row shows its store. Ordered `recorded_at desc`.
- `PriceHistoryPopover` shows "«Store» — «price» · «date»" per row.
- The "last seen $X" add-field hint uses the most recent record **anywhere**,
  labeled with the store.

**Autocomplete.**
- New `useGroceryNameSuggestions()` → household-wide distinct item names, unioned
  from current `grocery_items.name` (all pages) and `grocery_price_history.item_name`,
  deduped by normalized name (prefer a display-cased variant). Key `['grocery','names']`.
- `GroceryPageView` add-field renders a suggestion dropdown of matches to the
  current input (case-insensitive `includes`, capped ~8); selecting fills the
  field. Keyboard-navigable; hidden when empty or exact-match.

**Caveat.** `grocery_price_history.page_id` cascades on page delete, so global
history spans existing stores; deleting a store removes its prices. Accepted.

**Tests.** Hook tests for the household-wide history query (no `page_id` filter,
joins store) and the suggestions query/union+dedup; `PriceHistoryPopover` shows
store labels; `GroceryPageView` shows and applies a suggestion. **Live**: record
a price for "Milk" on two different store pages, confirm the popover shows both
with store labels; confirm a suggestion surfaces across pages.

---

## Cross-cutting

- Each feature: `npm test`, lint, `tsc`, build; schema features also
  `supabase db reset --local` + `db lint` + reseed + a live scratchpad script.
- Migrations continue the CLI timestamp convention in `supabase/migrations/`.
- Types regenerated via `supabase gen types typescript --local` after each
  migration.
- Independent commits, in order F1 → F2 → F3 (no interdependencies; this order is
  just largest-first).
