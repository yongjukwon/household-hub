-- Per-month budget limits (Reminder follow-up): a category's limit can now
-- differ month to month. budget_categories.monthly_limit is kept as the
-- baseline/fallback; a row here overrides it for a specific month, and the
-- effective limit for a month is the most recent override at-or-before it
-- (carry-forward until changed) — computed in the client data layer.

create table budget_category_limits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  category_id uuid not null,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount numeric(10, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, month),
  -- Same composite FK as budget_entries: keeps category/page/household
  -- consistent so a limit can't be paired with a category from another page.
  constraint budget_category_limits_category_page_fkey
    foreign key (category_id, page_id, household_id)
    references budget_categories(id, page_id, household_id)
    on delete cascade
);

-- Reuse the budget tenant-derivation trigger (verifies the page is a budget
-- template page and sets household_id from it).
create trigger trg_budget_category_limits_household
  before insert or update of page_id, household_id on budget_category_limits
  for each row execute function set_budget_household_id_from_page();

create trigger trg_budget_category_limits_updated_at
  before update on budget_category_limits
  for each row execute function set_updated_at();

alter table budget_category_limits enable row level security;

create policy "household rw" on budget_category_limits for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create index budget_category_limits_category_month_idx
  on budget_category_limits (category_id, month);

-- Live-updated across clients (Phase 5 pattern).
alter publication supabase_realtime add table budget_category_limits;
alter table budget_category_limits replica identity full;
