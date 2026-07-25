-- Mobile-first relational model. These tables intentionally live beside the
-- legacy page-based tables until the old web client is retired.

create or replace function public.mobile_is_iso_currency_code(candidate text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select candidate = any (array[
    'AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN',
    'BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BOV','BRL',
    'BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHE','CHF','CHW','CLF',
    'CLP','CNY','COP','COU','CRC','CUP','CVE','CZK','DJF','DKK','DOP',
    'DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP',
    'GMD','GNF','GTQ','GYD','HKD','HNL','HTG','HUF','IDR','ILS','INR',
    'IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KPW',
    'KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD',
    'MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN',
    'MXV','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB',
    'PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF',
    'SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SOS','SRD','SSP',
    'STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD',
    'TWD','TZS','UAH','UGX','USD','USN','UYI','UYU','UYW','UZS','VED',
    'VES','VND','VUV','WST','XAF','XCD','XCG','XDR','XOF','XPF','XSU',
    'XUA','XXX','YER','ZAR','ZMW','ZWG'
  ]::text[]);
$$;

create or replace function public.mobile_is_iana_timezone(candidate text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names()
    where name = candidate
  );
$$;

alter table public.households
  add column owner_user_id uuid references auth.users(id) on delete restrict,
  add column revision bigint not null default 1 check (revision >= 1),
  add column updated_at timestamptz not null default now();

alter table public.household_members
  add column member_role text not null default 'member'
    check (member_role in ('owner', 'member')),
  add column revision bigint not null default 1 check (revision >= 1),
  add column updated_at timestamptz not null default now();

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  avatar_url text,
  appearance text not null default 'system'
    check (appearance in ('light', 'dark', 'system')),
  notifications_enabled boolean not null default true,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (
    (redeemed_at is null and redeemed_by is null)
    or (redeemed_at is not null and redeemed_by is not null)
  )
);

create table public.ledger_assets (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  kind text not null
    check (kind in ('cash', 'checking', 'savings', 'credit', 'investment', 'other')),
  currency_code text not null
    check (public.mobile_is_iso_currency_code(currency_code)),
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.asset_postings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  asset_id uuid not null,
  operation_id uuid not null,
  effect_type text not null check (btrim(effect_type) <> ''),
  effect_id uuid not null,
  leg text not null check (btrim(leg) <> ''),
  amount_cents bigint not null check (
    amount_cents <> 0
    and amount_cents between -9007199254740991 and 9007199254740991
  ),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (asset_id, household_id)
    references public.ledger_assets(id, household_id) on delete restrict,
  unique (operation_id, effect_type, effect_id, asset_id, leg)
);

create view public.ledger_asset_balances
with (security_invoker = true)
as
select
  a.id,
  a.household_id,
  a.name,
  a.kind,
  a.currency_code,
  a.sort_order,
  a.created_by,
  a.revision,
  a.created_at,
  a.updated_at,
  coalesce(sum(p.amount_cents), 0)::bigint as balance_cents
from public.ledger_assets a
left join public.asset_postings p on p.asset_id = a.id
group by
  a.id,
  a.household_id,
  a.name,
  a.kind,
  a.currency_code,
  a.sort_order,
  a.created_by,
  a.revision,
  a.created_at,
  a.updated_at;

create table public.ledger_transfer_schedules (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  from_asset_id uuid not null,
  to_asset_id uuid not null,
  amount_cents bigint not null check (
    amount_cents between 1 and 9007199254740991
  ),
  frequency text not null
    check (frequency in ('weekly', 'biweekly', 'semi_monthly', 'monthly')),
  starts_at timestamptz not null,
  timezone text not null check (public.mobile_is_iana_timezone(timezone)),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_asset_id <> to_asset_id),
  foreign key (from_asset_id, household_id)
    references public.ledger_assets(id, household_id) on delete restrict,
  foreign key (to_asset_id, household_id)
    references public.ledger_assets(id, household_id) on delete restrict,
  unique (id, household_id)
);

create table public.ledger_transfers (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  from_asset_id uuid not null,
  to_asset_id uuid not null,
  amount_cents bigint not null check (
    amount_cents between 1 and 9007199254740991
  ),
  occurred_at timestamptz not null,
  note text,
  schedule_id uuid,
  occurrence_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_asset_id <> to_asset_id),
  check (
    (schedule_id is null and occurrence_date is null)
    or (schedule_id is not null and occurrence_date is not null)
  ),
  foreign key (from_asset_id, household_id)
    references public.ledger_assets(id, household_id) on delete restrict,
  foreign key (to_asset_id, household_id)
    references public.ledger_assets(id, household_id) on delete restrict,
  foreign key (schedule_id, household_id)
    references public.ledger_transfer_schedules(id, household_id) on delete restrict,
  unique (id, household_id)
);

create unique index ledger_transfers_schedule_occurrence_idx
  on public.ledger_transfers(schedule_id, occurrence_date)
  where schedule_id is not null;

create table public.ledger_years (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  year integer not null check (year between 1900 and 9999),
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, year)
);

create table public.ledger_months (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  year_id uuid not null,
  month smallint not null check (month between 1 and 12),
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (year_id, household_id)
    references public.ledger_years(id, household_id) on delete cascade,
  unique (id, household_id),
  unique (id, year_id, household_id),
  unique (year_id, month)
);

create table public.ledger_categories (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  year_id uuid not null,
  kind text not null check (kind in ('income', 'spending')),
  system_key text,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (year_id, household_id)
    references public.ledger_years(id, household_id) on delete cascade,
  unique (id, household_id)
);

create unique index ledger_categories_system_key_idx
  on public.ledger_categories(year_id, system_key)
  where system_key is not null;

create table public.ledger_month_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month_id uuid not null,
  category_id uuid not null,
  name text not null check (btrim(name) <> ''),
  sort_order integer not null default 0,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, household_id)
    references public.ledger_categories(id, household_id) on delete cascade,
  foreign key (month_id, household_id)
    references public.ledger_months(id, household_id) on delete cascade,
  unique (month_id, category_id),
  unique (month_id, category_id, household_id)
);

create table public.ledger_month_limits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month_id uuid not null,
  category_id uuid not null,
  limit_entity_id uuid not null,
  amount_cents bigint check (
    amount_cents is null
    or amount_cents between 0 and 9007199254740991
  ),
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (month_id, category_id, household_id)
    references public.ledger_month_categories(month_id, category_id, household_id)
    on delete cascade,
  unique (month_id, category_id)
);

create table public.household_trips (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  destination text not null check (btrim(destination) <> ''),
  destination_timezone text not null
    check (public.mobile_is_iana_timezone(destination_timezone)),
  destination_currency text not null
    check (public.mobile_is_iso_currency_code(destination_currency)),
  start_date date not null,
  end_date date not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (id, household_id)
);

create table public.trip_expenses (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null,
  asset_id uuid not null,
  amount_cents bigint not null check (
    amount_cents between 1 and 9007199254740991
  ),
  currency_code text not null
    check (public.mobile_is_iso_currency_code(currency_code)),
  spent_at timestamptz not null,
  description text not null check (btrim(description) <> ''),
  ledger_transaction_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, household_id)
    references public.household_trips(id, household_id) on delete cascade,
  foreign key (asset_id, household_id)
    references public.ledger_assets(id, household_id) on delete restrict,
  unique (id, household_id),
  unique (ledger_transaction_id)
);

create table public.ledger_transactions (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  year_id uuid not null,
  month_id uuid not null,
  category_id uuid not null,
  asset_id uuid not null,
  kind text not null check (kind in ('income', 'spending')),
  amount_cents bigint not null check (
    amount_cents between 1 and 9007199254740991
  ),
  occurred_at timestamptz not null,
  description text not null check (btrim(description) <> ''),
  trip_expense_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (year_id, household_id)
    references public.ledger_years(id, household_id) on delete cascade,
  foreign key (month_id, year_id, household_id)
    references public.ledger_months(id, year_id, household_id) on delete cascade,
  foreign key (month_id, category_id, household_id)
    references public.ledger_month_categories(month_id, category_id, household_id)
    on delete restrict,
  foreign key (category_id, household_id)
    references public.ledger_categories(id, household_id) on delete restrict,
  foreign key (asset_id, household_id)
    references public.ledger_assets(id, household_id) on delete restrict,
  foreign key (trip_expense_id, household_id)
    references public.trip_expenses(id, household_id) on delete cascade,
  unique (id, household_id),
  unique (trip_expense_id)
);

alter table public.trip_expenses
  add constraint trip_expenses_ledger_transaction_fkey
  foreign key (ledger_transaction_id, household_id)
  references public.ledger_transactions(id, household_id)
  on delete set null;

create table public.household_notes (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  document jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.household_grocery_lists (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.household_grocery_items (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  list_id uuid not null,
  name text not null check (btrim(name) <> ''),
  name_normalized text generated always as (lower(btrim(name))) stored,
  quantity text,
  checked boolean not null default false,
  unit_price_cents bigint check (
    unit_price_cents is null
    or unit_price_cents between 0 and 9007199254740991
  ),
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (list_id, household_id)
    references public.household_grocery_lists(id, household_id) on delete cascade,
  unique (id, household_id)
);

create table public.household_grocery_price_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  list_id uuid not null,
  item_name text not null check (btrim(item_name) <> ''),
  item_name_normalized text not null check (btrim(item_name_normalized) <> ''),
  price_cents bigint not null check (
    price_cents between 1 and 9007199254740991
  ),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  foreign key (list_id, household_id)
    references public.household_grocery_lists(id, household_id) on delete cascade
);

alter table public.calendar_events
  add column event_timezone text,
  add column start_date date,
  add column end_date date,
  add column revision bigint not null default 1 check (revision >= 1);

update public.calendar_events
set
  event_timezone = 'UTC',
  start_date = case when all_day then start_at::date else null end,
  end_date = case when all_day then end_at::date else null end;

alter table public.calendar_events
  alter column start_at drop not null,
  alter column end_at drop not null,
  alter column event_timezone set not null;

update public.calendar_events
set start_at = null, end_at = null
where all_day;

alter table public.calendar_events
  add constraint calendar_events_mobile_time_shape check (
    (
      not all_day
      and start_at is not null
      and end_at is not null
      and end_at > start_at
      and start_date is null
      and end_date is null
    )
    or (
      all_day
      and start_at is null
      and end_at is null
      and start_date is not null
      and end_date is not null
      and end_date >= start_date
    )
  ),
  add constraint calendar_events_mobile_timezone check (
    public.mobile_is_iana_timezone(event_timezone)
  ),
  add constraint calendar_events_id_household_key unique (id, household_id);

create table public.calendar_event_reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  event_id uuid not null,
  preset text not null check (preset in ('at_time', '10m', '1h', '1d', '1w')),
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, household_id)
    references public.calendar_events(id, household_id) on delete cascade,
  unique (event_id, preset)
);

create table public.notifications (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  kind text not null check (btrim(kind) <> ''),
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.operation_receipts (
  operation_id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  device_id uuid not null,
  local_sequence bigint not null check (
    local_sequence between 0 and 9007199254740991
  ),
  command_hash bytea not null,
  server_sequence bigint check (server_sequence >= 1),
  status text not null
    check (status in ('applied', 'conflict', 'rejected')),
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (household_id, server_sequence)
);

create table public.household_entity_revisions (
  household_id uuid not null references public.households(id) on delete cascade,
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id uuid not null,
  revision bigint not null check (revision >= 1),
  deleted boolean not null default false,
  last_operation_id uuid not null,
  winner_type text not null,
  winner_entity_type text not null,
  winner_entity_id uuid not null,
  applied_at timestamptz not null,
  primary key (household_id, entity_type, entity_id)
);

create table public.household_tombstones (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id uuid not null,
  revision bigint not null check (revision >= 1),
  operation_id uuid not null,
  deleted_at timestamptz not null default now(),
  unique (household_id, entity_type, entity_id)
);

create table public.household_change_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  server_sequence bigint not null check (server_sequence >= 1),
  operation_id uuid not null unique,
  operation_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  entity_revision bigint not null check (entity_revision >= 1),
  change_kind text not null check (change_kind in ('upsert', 'delete', 'clear', 'read')),
  changed_at timestamptz not null default now(),
  unique (household_id, server_sequence)
);

create index household_invites_household_idx
  on public.household_invites(household_id, expires_at desc);
create index asset_postings_asset_idx
  on public.asset_postings(asset_id, occurred_at, created_at);
create index ledger_years_household_year_idx
  on public.ledger_years(household_id, year);
create index ledger_transactions_month_idx
  on public.ledger_transactions(month_id, occurred_at, id);
create index household_notes_household_idx
  on public.household_notes(household_id, updated_at desc);
create index household_grocery_lists_household_idx
  on public.household_grocery_lists(household_id, sort_order, id);
create index household_grocery_items_list_idx
  on public.household_grocery_items(list_id, checked, sort_order, id);
create index household_grocery_history_lookup_idx
  on public.household_grocery_price_history(
    household_id,
    item_name_normalized,
    recorded_at desc
  );
create index calendar_events_household_dates_idx
  on public.calendar_events(household_id, start_date, start_at);
create index notifications_recipient_idx
  on public.notifications(recipient_user_id, read_at, created_at desc);
create index household_trips_household_idx
  on public.household_trips(household_id, start_date desc);
create index trip_expenses_trip_idx
  on public.trip_expenses(trip_id, spent_at, id);
create index operation_receipts_household_created_idx
  on public.operation_receipts(household_id, created_at desc);
create index household_change_log_sequence_idx
  on public.household_change_log(household_id, server_sequence);
