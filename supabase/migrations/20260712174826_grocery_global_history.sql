-- Global (household-wide) grocery knowledge: price history and name
-- autocomplete should span every store page, not just one.
--
-- Add a display item_name to grocery_price_history so the cross-store history
-- popover and the autocomplete can show proper casing ("Whole Milk", not
-- "whole milk") — the normalized name alone loses it. Populated going forward
-- by the recording trigger from the item's display name. Existing rows keep
-- only the normalized name (dev data, no backfill needed).

alter table grocery_price_history
  add column item_name text;

-- Recompile the price-recording trigger to also snapshot the display name.
create or replace function record_grocery_price_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.last_price is not null
    and new.last_price > 0
    and (tg_op = 'INSERT' or new.last_price is distinct from old.last_price)
  then
    insert into grocery_price_history
      (household_id, page_id, item_name_normalized, item_name, price, recorded_by)
    values
      (new.household_id, new.page_id, new.name_normalized, new.name, new.last_price, auth.uid());
  end if;
  return new;
end;
$$;

-- Household-wide lookups by normalized name (both the popover and the
-- last-seen hint filter on household_id + item_name_normalized now).
create index grocery_price_history_household_name_idx
  on grocery_price_history (household_id, item_name_normalized, recorded_at desc);
