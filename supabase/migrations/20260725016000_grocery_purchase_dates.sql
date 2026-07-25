-- Server-owned purchase timestamps for checked Grocery items.
alter table public.household_grocery_items
  add column if not exists checked_at timestamptz;

create or replace function public.mobile_set_grocery_checked_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.checked and (tg_op = 'INSERT' or not old.checked) then
    new.checked_at := clock_timestamp();
  elsif not new.checked then
    new.checked_at := null;
  elsif tg_op = 'UPDATE' then
    -- Preserve the original purchase moment when other item fields change.
    new.checked_at := old.checked_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mobile_grocery_checked_at
  on public.household_grocery_items;

create trigger trg_mobile_grocery_checked_at
before insert or update of checked
on public.household_grocery_items
for each row execute function public.mobile_set_grocery_checked_at();

revoke all on function public.mobile_set_grocery_checked_at() from public;
