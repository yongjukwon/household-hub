-- Savings: a household-wide flat list of savings sources (no pages), each with
-- a running balance backed by a deposit/withdrawal ledger, plus optional
-- semi-monthly auto-deposit rules. The balance is maintained by a trigger so
-- the transaction log is the single, trustworthy explanation of every change.

create type savings_transaction_type as enum ('deposit', 'withdrawal');

-- Root-level table (like `pages`): household_id is client-supplied from
-- useHousehold(), validated by the RLS with-check, since there is no parent to
-- derive it from.
create table savings_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  amount numeric(10, 2) not null default 0 check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Created before savings_transactions because a transaction may reference the
-- rule that generated it.
create table savings_deposit_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  source_id uuid not null references savings_sources(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  day_of_month_1 integer not null check (day_of_month_1 between 1 and 31),
  day_of_month_2 integer not null check (day_of_month_2 between 1 and 31),
  start_date date not null,
  active boolean not null default true,
  last_generated_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (day_of_month_1 <> day_of_month_2)
);

create table savings_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  source_id uuid not null references savings_sources(id) on delete cascade,
  type savings_transaction_type not null,
  amount numeric(10, 2) not null check (amount > 0),
  reason text,
  occurred_at date not null default current_date,
  created_by uuid not null references auth.users(id),
  auto_deposit_rule_id uuid references savings_deposit_rules(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Derive the tenant from the trusted source row (one hop shallower than the
-- budget/trip page-derivation triggers, but the same shape).
create or replace function set_savings_household_id_from_source()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_household_id uuid;
begin
  select household_id into parent_household_id
    from savings_sources
    where id = new.source_id;

  if not found then
    raise foreign_key_violation using message = 'savings row references a missing source';
  end if;

  new.household_id = parent_household_id;
  return new;
end;
$$;

create trigger trg_savings_deposit_rules_household
  before insert or update of source_id, household_id on savings_deposit_rules
  for each row execute function set_savings_household_id_from_source();

create trigger trg_savings_transactions_household
  before insert or update of source_id, household_id on savings_transactions
  for each row execute function set_savings_household_id_from_source();

-- Attribution is authoritative (reuses the pinned-search_path helper).
create trigger trg_savings_transactions_created_by
  before insert on savings_transactions
  for each row execute function set_created_by();

create trigger trg_savings_sources_updated_at
  before update on savings_sources
  for each row execute function set_updated_at();

create trigger trg_savings_deposit_rules_updated_at
  before update on savings_deposit_rules
  for each row execute function set_updated_at();

create trigger trg_savings_transactions_updated_at
  before update on savings_transactions
  for each row execute function set_updated_at();

-- The only writer of savings_sources.amount after creation: a deposit adds,
-- a withdrawal subtracts. UPDATE reverses the old effect and applies the new
-- (handling a transaction moved between sources); DELETE reverses. The
-- sources.amount >= 0 check makes an over-withdrawal fail the whole insert,
-- which is the intended guard.
create or replace function adjust_savings_source_amount()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update savings_sources
      set amount = amount + (case when new.type = 'deposit' then new.amount else -new.amount end)
      where id = new.source_id;
  elsif tg_op = 'DELETE' then
    update savings_sources
      set amount = amount - (case when old.type = 'deposit' then old.amount else -old.amount end)
      where id = old.source_id;
  elsif tg_op = 'UPDATE' then
    update savings_sources
      set amount = amount - (case when old.type = 'deposit' then old.amount else -old.amount end)
      where id = old.source_id;
    update savings_sources
      set amount = amount + (case when new.type = 'deposit' then new.amount else -new.amount end)
      where id = new.source_id;
  end if;
  return null;
end;
$$;

create trigger trg_savings_transactions_adjust_amount
  after insert or update or delete on savings_transactions
  for each row execute function adjust_savings_source_amount();

alter table savings_sources enable row level security;
alter table savings_deposit_rules enable row level security;
alter table savings_transactions enable row level security;

create policy "household rw" on savings_sources for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "household rw" on savings_deposit_rules for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "household rw" on savings_transactions for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create index savings_sources_household_idx
  on savings_sources (household_id, created_at);

create index savings_transactions_source_idx
  on savings_transactions (source_id, occurred_at desc, id desc);

create index savings_deposit_rules_source_idx
  on savings_deposit_rules (source_id);

-- Two clients both catching up the same auto-deposit occurrence must not
-- double-log it; the second insert hits this unique index.
create unique index savings_transactions_auto_dedup_idx
  on savings_transactions (auto_deposit_rule_id, occurred_at)
  where auto_deposit_rule_id is not null;

alter publication supabase_realtime add table
  savings_sources,
  savings_deposit_rules,
  savings_transactions;

alter table savings_sources replica identity full;
alter table savings_deposit_rules replica identity full;
alter table savings_transactions replica identity full;
