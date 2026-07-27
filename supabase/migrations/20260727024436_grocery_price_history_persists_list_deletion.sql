-- Bug: `household_grocery_price_history` is meant to be permanent, household-
-- wide purchase history that outlives any single grocery list (see
-- mobile/src/features/groceries/data.ts's useGroceryList, which already
-- reads `household_grocery_lists?.name ?? 'Unknown list'` in anticipation of
-- the source list being gone).
--
-- But the table's `(list_id, household_id)` foreign key to
-- household_grocery_lists was declared `on delete cascade`, so deleting a
-- grocery list (a normal action — see CLAUDE.md's "long-press page delete")
-- silently deletes every price-history row ever recorded through that list's
-- items, for every item name, household-wide. Re-adding "the same item"
-- afterwards then has no prior price to show: cheapestPriceHistory() and
-- latestPriceByName() only ever see rows recorded since the last list
-- deletion. Reproduced directly against a local stack: adding an item with a
-- price, deleting its list, and re-adding the same item name leaves the
-- earlier price gone from `household_grocery_price_history`.
--
-- Fix: let list_id go null instead of cascading the delete. household_id
-- keeps its own (non-composite) cascade to households, which is the correct
-- lifetime for this data — it should only disappear with the whole
-- household, never with one of its lists.

alter table public.household_grocery_price_history
  drop constraint household_grocery_price_history_list_id_household_id_fkey;

alter table public.household_grocery_price_history
  alter column list_id drop not null;

alter table public.household_grocery_price_history
  add constraint household_grocery_price_history_list_id_fkey
    foreign key (list_id) references public.household_grocery_lists(id)
    on delete set null;
