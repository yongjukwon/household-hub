create table grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  name_normalized text generated always as (lower(btrim(name))) stored,
  checked boolean not null default false,
  last_price numeric(10, 2) check (last_price is null or last_price >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Price history deliberately has NO foreign key to grocery_items and is keyed
-- by (page_id, item_name_normalized): its whole purpose is to survive items
-- being deleted by "clear checked" and re-added later (see the
-- supabase-rls-tenant-scoping skill's history-table rule).
create table grocery_price_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  item_name_normalized text not null check (btrim(item_name_normalized) <> ''),
  price numeric(10, 2) not null check (price > 0),
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now()
);

create or replace function set_grocery_household_id_from_page()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_household_id uuid;
  parent_section page_section;
  parent_template page_template;
begin
  select household_id, section, template
    into parent_household_id, parent_section, parent_template
    from pages
    where id = new.page_id;

  if not found then
    raise foreign_key_violation using message = 'grocery row references a missing page';
  end if;

  if parent_section <> 'grocery' or parent_template <> 'grocery' then
    raise check_violation using message = 'grocery rows require a grocery template page';
  end if;

  new.household_id = parent_household_id;
  return new;
end;
$$;

create trigger trg_grocery_items_household
  before insert or update of page_id, household_id on grocery_items
  for each row execute function set_grocery_household_id_from_page();

create trigger trg_grocery_price_history_household
  before insert or update of page_id, household_id on grocery_price_history
  for each row execute function set_grocery_household_id_from_page();

create trigger trg_grocery_items_updated_at
  before update on grocery_items
  for each row execute function set_updated_at();

-- History rows are written here, not by the client: recording a price on an
-- item appends atomically, attributed to the writer, no matter which device
-- or replayed offline mutation performs the write.
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
      (household_id, page_id, item_name_normalized, price, recorded_by)
    values
      (new.household_id, new.page_id, new.name_normalized, new.last_price, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_grocery_items_price_history
  after insert or update of last_price on grocery_items
  for each row execute function record_grocery_price_history();

alter table grocery_items enable row level security;
alter table grocery_price_history enable row level security;

create policy "household rw" on grocery_items for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Append-only from the API: no update/delete policies, and inserts happen via
-- the grocery_items trigger (definer context) or a member's own write.
create policy "household read" on grocery_price_history for select
  using (is_household_member(household_id));
create policy "household insert" on grocery_price_history for insert
  with check (is_household_member(household_id));

create index grocery_items_page_name_idx
  on grocery_items (page_id, name_normalized);

create index grocery_items_page_sort_idx
  on grocery_items (page_id, sort_order);

create index grocery_price_history_lookup_idx
  on grocery_price_history (page_id, item_name_normalized, recorded_at desc);
