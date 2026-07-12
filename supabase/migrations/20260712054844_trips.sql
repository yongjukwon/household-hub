create type booking_type as enum ('flight', 'hotel', 'car', 'other');

create table trip_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  item_date date not null,
  start_time time,
  title text not null check (btrim(title) <> ''),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trip_bookings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  type booking_type not null,
  title text not null check (btrim(title) <> ''),
  confirmation_number text,
  address text,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create table trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  label text not null check (btrim(label) <> ''),
  checked boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Derive the tenant from the trusted page row on inserts and whenever either
-- relationship field is updated, and reject trip rows on pages that are not
-- trip-template pages (mirrors set_budget_household_id_from_page).
create or replace function set_trip_household_id_from_page()
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
    raise foreign_key_violation using message = 'trip row references a missing page';
  end if;

  if parent_section <> 'trip' or parent_template <> 'trip' then
    raise check_violation using message = 'trip rows require a trip template page';
  end if;

  new.household_id = parent_household_id;
  return new;
end;
$$;

create trigger trg_trip_itinerary_items_household
  before insert or update of page_id, household_id on trip_itinerary_items
  for each row execute function set_trip_household_id_from_page();

create trigger trg_trip_bookings_household
  before insert or update of page_id, household_id on trip_bookings
  for each row execute function set_trip_household_id_from_page();

create trigger trg_trip_checklist_items_household
  before insert or update of page_id, household_id on trip_checklist_items
  for each row execute function set_trip_household_id_from_page();

create trigger trg_trip_itinerary_items_updated_at
  before update on trip_itinerary_items
  for each row execute function set_updated_at();

create trigger trg_trip_bookings_updated_at
  before update on trip_bookings
  for each row execute function set_updated_at();

create trigger trg_trip_checklist_items_updated_at
  before update on trip_checklist_items
  for each row execute function set_updated_at();

alter table trip_itinerary_items enable row level security;
alter table trip_bookings enable row level security;
alter table trip_checklist_items enable row level security;

create policy "household rw" on trip_itinerary_items for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "household rw" on trip_bookings for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "household rw" on trip_checklist_items for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create index trip_itinerary_items_page_date_idx
  on trip_itinerary_items (page_id, item_date, sort_order);

create index trip_bookings_page_sort_idx
  on trip_bookings (page_id, sort_order);

create index trip_checklist_items_page_sort_idx
  on trip_checklist_items (page_id, sort_order);
