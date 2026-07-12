create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  monthly_limit numeric(10, 2) not null default 0 check (monthly_limit >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, page_id, household_id)
);

create table budget_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  category_id uuid not null,
  amount numeric(10, 2) not null check (amount > 0),
  description text,
  entry_date date not null default current_date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_entries_category_page_fkey
    foreign key (category_id, page_id, household_id)
    references budget_categories(id, page_id, household_id)
    on delete cascade
);

-- Derive the tenant from the trusted page row on inserts and whenever either
-- relationship field is updated. Also reject use of budget data on a page
-- whose section/template does not support it.
create or replace function set_budget_household_id_from_page()
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
    raise foreign_key_violation using message = 'budget row references a missing page';
  end if;

  if parent_section <> 'budget' or parent_template <> 'budget' then
    raise check_violation using message = 'budget rows require a budget template page';
  end if;

  new.household_id = parent_household_id;
  return new;
end;
$$;

create trigger trg_budget_categories_household
  before insert or update of page_id, household_id on budget_categories
  for each row execute function set_budget_household_id_from_page();

create trigger trg_budget_entries_household
  before insert or update of page_id, household_id on budget_entries
  for each row execute function set_budget_household_id_from_page();

-- Attribution is authoritative: callers cannot impersonate another member.
-- Phase 1 created this shared trigger function without a fixed search_path;
-- pin it before reusing it so name resolution cannot be influenced by a
-- caller-controlled schema.
alter function public.set_created_by() set search_path = public;

create trigger trg_budget_entries_created_by
  before insert on budget_entries
  for each row execute function set_created_by();

create trigger trg_budget_categories_updated_at
  before update on budget_categories
  for each row execute function set_updated_at();

create trigger trg_budget_entries_updated_at
  before update on budget_entries
  for each row execute function set_updated_at();

alter table budget_categories enable row level security;
alter table budget_entries enable row level security;

create policy "household rw" on budget_categories for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "household rw" on budget_entries for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create index budget_categories_page_sort_idx
  on budget_categories (page_id, sort_order);

create index budget_entries_page_date_idx
  on budget_entries (page_id, entry_date desc, id);

create index budget_entries_category_date_idx
  on budget_entries (category_id, entry_date desc, id);
