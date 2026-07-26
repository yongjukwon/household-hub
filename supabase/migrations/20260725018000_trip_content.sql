-- Trip content: Itinerary, Bookings, Checklist.
--
-- Mobile-first tables parallel to household_trips/trip_expenses (Task 2),
-- not the legacy page-based trip_itinerary_items/trip_bookings/
-- trip_checklist_items (which stay keyed to `pages` and are never read or
-- written by the rebuilt clients). Table/schema shape is deliberately
-- modeled on that legacy design's first version (before its later
-- open_time/close_time/ticket_url/map_url/confirmation_url refinement) as
-- proven prior art for the same product concept, adapted to key off
-- `trip_id` + `household_id` instead of `page_id` and to use the
-- client-supplied-household_id + composite-FK pattern the mobile-first
-- schema uses elsewhere (household_trips, trip_expenses) rather than a
-- trigger-derived tenant column.

create table public.trip_itinerary_entries (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null,
  item_date date not null,
  start_time time,
  title text not null check (btrim(title) <> ''),
  notes text,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, household_id)
    references public.household_trips(id, household_id) on delete cascade,
  unique (id, household_id)
);

create table public.trip_booking_entries (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null,
  kind text not null check (kind in ('flight', 'hotel', 'car', 'other')),
  title text not null check (btrim(title) <> ''),
  confirmation_number text,
  address text,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, household_id)
    references public.household_trips(id, household_id) on delete cascade,
  unique (id, household_id),
  check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create table public.trip_checklist_entries (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null,
  label text not null check (btrim(label) <> ''),
  checked boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, household_id)
    references public.household_trips(id, household_id) on delete cascade,
  unique (id, household_id)
);

alter table public.trip_expenses
  add column itinerary_entry_id uuid
    references public.trip_itinerary_entries(id) on delete set null,
  add column booking_entry_id uuid
    references public.trip_booking_entries(id) on delete set null,
  add constraint trip_expenses_single_activity_link
    check (num_nonnulls(itinerary_entry_id, booking_entry_id) <= 1);

create index trip_itinerary_entries_trip_date_idx
  on public.trip_itinerary_entries (trip_id, item_date, sort_order);
create index trip_booking_entries_trip_sort_idx
  on public.trip_booking_entries (trip_id, sort_order);
create index trip_checklist_entries_trip_sort_idx
  on public.trip_checklist_entries (trip_id, sort_order);

alter table public.trip_itinerary_entries enable row level security;
alter table public.trip_booking_entries enable row level security;
alter table public.trip_checklist_entries enable row level security;

create policy "trip itinerary entries read"
  on public.trip_itinerary_entries for select
  using (public.is_household_member(household_id));
create policy "trip booking entries read"
  on public.trip_booking_entries for select
  using (public.is_household_member(household_id));
create policy "trip checklist entries read"
  on public.trip_checklist_entries for select
  using (public.is_household_member(household_id));

revoke insert, update, delete, truncate on table
  public.trip_itinerary_entries,
  public.trip_booking_entries,
  public.trip_checklist_entries
from authenticated, anon;

grant select on table
  public.trip_itinerary_entries,
  public.trip_booking_entries,
  public.trip_checklist_entries
to authenticated, service_role;

alter publication supabase_realtime add table
  public.trip_itinerary_entries,
  public.trip_booking_entries,
  public.trip_checklist_entries;

alter table public.trip_itinerary_entries replica identity full;
alter table public.trip_booking_entries replica identity full;
alter table public.trip_checklist_entries replica identity full;

-- The three functions below are copied in full from
-- 20260725011000_household_operation_rpc.sql and re-declared with six new
-- operation types spliced in (trip.itinerary.upsert/delete,
-- trip.booking.upsert/delete, trip.checklist.upsert/delete). Everything else
-- is byte-identical to the prior version — the additions were generated by a
-- scripted, anchor-based text insertion into the original migration's exact
-- content (not retyped), and diffed against the original to confirm zero
-- unintended changes, specifically to avoid the risk of a manual transcription
-- error in a 2900-line stored procedure that every existing operation type
-- also depends on.

create or replace function public.mobile_expected_entity_type(
  operation_type text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when operation_type like 'calendar.event.%' then 'calendar_event'
    when operation_type like 'grocery.list.%' then 'grocery_list'
    when operation_type like 'grocery.item.%' then 'grocery_item'
    when operation_type like 'ledger.asset.%' then 'ledger_asset'
    when operation_type like 'ledger.year.%' then 'ledger_year'
    when operation_type like 'ledger.category.%' then 'ledger_category'
    when operation_type like 'ledger.limit.%' then 'ledger_limit'
    when operation_type like 'ledger.transaction.%' then 'ledger_transaction'
    when operation_type like 'ledger.transfer.%' then 'ledger_transfer'
    when operation_type like 'ledger.schedule.%' then 'ledger_schedule'
    when operation_type like 'note.%' then 'note'
    when operation_type like 'trip.expense.%' then 'trip_expense'
    when operation_type like 'trip.itinerary.%' then 'trip_itinerary_entry'
    when operation_type like 'trip.booking.%' then 'trip_booking_entry'
    when operation_type like 'trip.checklist.%' then 'trip_checklist_entry'
    when operation_type like 'trip.%' then 'trip'
    when operation_type = 'notification.read' then 'notification'
    when operation_type = 'settings.update' then 'settings'
    else null
  end;
$$;

create or replace function public.mobile_operation_payload_valid(
  operation_type text,
  payload jsonb
)
returns boolean
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  reminder jsonb;
  reminder_preset text;
  seen_reminders text[] := array[]::text[];
begin
  if jsonb_typeof(payload) <> 'object' then
    return false;
  end if;

  case operation_type
    when 'calendar.event.upsert' then
      if not public.mobile_json_keys_valid(
        payload,
        array[
          'title','note','ownerId','allDay','timezone',
          'recurrenceFrequency','recurrenceUntil','reminders'
        ],
        array['startAt','endAt','startDate','endDate']
      )
      or jsonb_typeof(payload->'title') <> 'string'
      or btrim(payload->>'title') = ''
      or not (
        payload->'note' = 'null'::jsonb
        or jsonb_typeof(payload->'note') = 'string'
      )
      or not (
        payload->'ownerId' = 'null'::jsonb
        or public.mobile_json_is_uuid(payload->'ownerId')
      )
      or jsonb_typeof(payload->'allDay') <> 'boolean'
      or jsonb_typeof(payload->'timezone') <> 'string'
      or not public.mobile_is_iana_timezone(payload->>'timezone')
      or jsonb_typeof(payload->'recurrenceFrequency') <> 'string'
      or payload->>'recurrenceFrequency' not in (
        'none','daily','weekly','monthly','yearly'
      )
      or not (
        payload->'recurrenceUntil' = 'null'::jsonb
        or (
          jsonb_typeof(payload->'recurrenceUntil') = 'string'
          and public.mobile_is_iso_date(payload->>'recurrenceUntil')
        )
      )
      or jsonb_typeof(payload->'reminders') <> 'array'
      then
        return false;
      end if;

      if (payload->>'allDay')::boolean then
        if payload ? 'startAt'
           or payload ? 'endAt'
           or not payload ? 'startDate'
           or not payload ? 'endDate'
           or jsonb_typeof(payload->'startDate') <> 'string'
           or jsonb_typeof(payload->'endDate') <> 'string'
           or not public.mobile_is_iso_date(payload->>'startDate')
           or not public.mobile_is_iso_date(payload->>'endDate')
           or (payload->>'endDate')::date < (payload->>'startDate')::date
        then
          return false;
        end if;
      else
        if payload ? 'startDate'
           or payload ? 'endDate'
           or not payload ? 'startAt'
           or not payload ? 'endAt'
           or jsonb_typeof(payload->'startAt') <> 'string'
           or jsonb_typeof(payload->'endAt') <> 'string'
           or right(payload->>'startAt', 1) <> 'Z'
           or right(payload->>'endAt', 1) <> 'Z'
           or not public.mobile_is_iso_instant(payload->>'startAt')
           or not public.mobile_is_iso_instant(payload->>'endAt')
           or (payload->>'endAt')::timestamptz
              <= (payload->>'startAt')::timestamptz
        then
          return false;
        end if;
      end if;

      for reminder in select value from jsonb_array_elements(payload->'reminders')
      loop
        reminder_preset := trim(both '"' from reminder::text);
        if jsonb_typeof(reminder) <> 'string'
           or reminder_preset not in (
             'at_time','10m','1h','1d','1w'
           )
           or reminder_preset = any(seen_reminders)
        then
          return false;
        end if;
        seen_reminders := array_append(seen_reminders, reminder_preset);
      end loop;
      return true;

    when 'calendar.event.delete',
         'grocery.list.delete',
         'grocery.item.delete',
         'ledger.asset.delete',
         'ledger.transaction.delete',
         'ledger.transfer.delete',
         'ledger.schedule.delete',
         'note.delete',
         'trip.delete',
         'trip.expense.delete',
         'trip.itinerary.delete',
         'trip.booking.delete',
         'trip.checklist.delete' then
      return public.mobile_json_keys_valid(payload, array[]::text[]);

    when 'grocery.list.upsert' then
      return
        public.mobile_json_keys_valid(payload, array['name','sortOrder'])
        and jsonb_typeof(payload->'name') = 'string'
        and btrim(payload->>'name') <> ''
        and public.mobile_json_is_integer(
          payload->'sortOrder',
          -2147483648,
          2147483647
        );

    when 'grocery.item.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'listId','name','quantity','checked','unitPriceCents','sortOrder'
          ]
        )
        and public.mobile_json_is_uuid(payload->'listId')
        and jsonb_typeof(payload->'name') = 'string'
        and btrim(payload->>'name') <> ''
        and (
          payload->'quantity' = 'null'::jsonb
          or jsonb_typeof(payload->'quantity') = 'string'
        )
        and jsonb_typeof(payload->'checked') = 'boolean'
        and (
          payload->'unitPriceCents' = 'null'::jsonb
          or public.mobile_json_is_integer(
            payload->'unitPriceCents',
            0,
            9007199254740991
          )
        )
        and public.mobile_json_is_integer(
          payload->'sortOrder',
          -2147483648,
          2147483647
        );

    when 'ledger.asset.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array['name','kind','currency','balanceCents','sortOrder']
        )
        and jsonb_typeof(payload->'name') = 'string'
        and btrim(payload->>'name') <> ''
        and jsonb_typeof(payload->'kind') = 'string'
        and payload->>'kind' in (
          'cash','checking','savings','credit','investment','other'
        )
        and jsonb_typeof(payload->'currency') = 'string'
        and public.mobile_is_iso_currency_code(payload->>'currency')
        and public.mobile_json_is_integer(
          payload->'balanceCents',
          -9007199254740991,
          9007199254740991
        )
        and public.mobile_json_is_integer(
          payload->'sortOrder',
          -2147483648,
          2147483647
        );

    when 'ledger.year.upsert' then
      return
        public.mobile_json_keys_valid(payload, array['year'])
        and public.mobile_json_is_integer(payload->'year', 1900, 9999);

    when 'ledger.year.clear' then
      return
        public.mobile_json_keys_valid(payload, array['year','confirmation'])
        and public.mobile_json_is_integer(payload->'year', 1900, 9999)
        and jsonb_typeof(payload->'confirmation') = 'string';

    when 'ledger.category.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array['yearId','fromMonth','name','kind','sortOrder']
        )
        and public.mobile_json_is_uuid(payload->'yearId')
        and public.mobile_json_is_integer(payload->'fromMonth', 1, 12)
        and jsonb_typeof(payload->'name') = 'string'
        and btrim(payload->>'name') <> ''
        and jsonb_typeof(payload->'kind') = 'string'
        and payload->>'kind' in ('income','spending')
        and public.mobile_json_is_integer(
          payload->'sortOrder',
          -2147483648,
          2147483647
        );

    when 'ledger.category.delete' then
      return
        public.mobile_json_keys_valid(payload, array['fromMonth'])
        and public.mobile_json_is_integer(payload->'fromMonth', 1, 12);

    when 'ledger.limit.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array['categoryId','fromMonth','amountCents']
        )
        and public.mobile_json_is_uuid(payload->'categoryId')
        and public.mobile_json_is_integer(payload->'fromMonth', 1, 12)
        and (
          payload->'amountCents' = 'null'::jsonb
          or public.mobile_json_is_integer(
            payload->'amountCents',
            0,
            9007199254740991
          )
        );

    when 'ledger.limit.delete' then
      return
        public.mobile_json_keys_valid(
          payload,
          array['categoryId','fromMonth']
        )
        and public.mobile_json_is_uuid(payload->'categoryId')
        and public.mobile_json_is_integer(payload->'fromMonth', 1, 12);

    when 'ledger.transaction.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'yearId','month','categoryId','assetId','kind','amountCents',
            'occurredAt','description'
          ]
        )
        and public.mobile_json_is_uuid(payload->'yearId')
        and public.mobile_json_is_integer(payload->'month', 1, 12)
        and public.mobile_json_is_uuid(payload->'categoryId')
        and public.mobile_json_is_uuid(payload->'assetId')
        and jsonb_typeof(payload->'kind') = 'string'
        and payload->>'kind' in ('income','spending')
        and public.mobile_json_is_integer(
          payload->'amountCents',
          1,
          9007199254740991
        )
        and jsonb_typeof(payload->'occurredAt') = 'string'
        and public.mobile_is_iso_instant(payload->>'occurredAt')
        and jsonb_typeof(payload->'description') = 'string'
        and btrim(payload->>'description') <> '';

    when 'ledger.transfer.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'fromAssetId','toAssetId','amountCents','occurredAt','note'
          ]
        )
        and public.mobile_json_is_uuid(payload->'fromAssetId')
        and public.mobile_json_is_uuid(payload->'toAssetId')
        and payload->>'fromAssetId' <> payload->>'toAssetId'
        and public.mobile_json_is_integer(
          payload->'amountCents',
          1,
          9007199254740991
        )
        and jsonb_typeof(payload->'occurredAt') = 'string'
        and public.mobile_is_iso_instant(payload->>'occurredAt')
        and (
          payload->'note' = 'null'::jsonb
          or jsonb_typeof(payload->'note') = 'string'
        );

    when 'ledger.schedule.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'fromAssetId','toAssetId','amountCents','frequency','startsAt',
            'timezone','active'
          ]
        )
        and public.mobile_json_is_uuid(payload->'fromAssetId')
        and public.mobile_json_is_uuid(payload->'toAssetId')
        and payload->>'fromAssetId' <> payload->>'toAssetId'
        and public.mobile_json_is_integer(
          payload->'amountCents',
          1,
          9007199254740991
        )
        and jsonb_typeof(payload->'frequency') = 'string'
        and payload->>'frequency' in (
          'weekly','biweekly','semi_monthly','monthly'
        )
        and jsonb_typeof(payload->'startsAt') = 'string'
        and public.mobile_is_iso_instant(payload->>'startsAt')
        and jsonb_typeof(payload->'timezone') = 'string'
        and public.mobile_is_iana_timezone(payload->>'timezone')
        and jsonb_typeof(payload->'active') = 'boolean';

    when 'note.upsert' then
      return
        public.mobile_json_keys_valid(payload, array['title','document'])
        and jsonb_typeof(payload->'title') = 'string'
        and btrim(payload->>'title') <> ''
        and public.mobile_note_node_valid(payload->'document', 'doc');

    when 'trip.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'name','destination','timezone','startDate','endDate',
            'destinationCurrency'
          ]
        )
        and jsonb_typeof(payload->'name') = 'string'
        and btrim(payload->>'name') <> ''
        and jsonb_typeof(payload->'destination') = 'string'
        and btrim(payload->>'destination') <> ''
        and jsonb_typeof(payload->'timezone') = 'string'
        and public.mobile_is_iana_timezone(payload->>'timezone')
        and jsonb_typeof(payload->'startDate') = 'string'
        and jsonb_typeof(payload->'endDate') = 'string'
        and public.mobile_is_iso_date(payload->>'startDate')
        and public.mobile_is_iso_date(payload->>'endDate')
        and (payload->>'endDate')::date >= (payload->>'startDate')::date
        and jsonb_typeof(payload->'destinationCurrency') = 'string'
        and public.mobile_is_iso_currency_code(
          payload->>'destinationCurrency'
        );

    when 'trip.expense.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'tripId','assetId','amountCents','currency','spentAt',
            'description'
          ],
          array['itineraryEntryId','bookingEntryId']
        )
        and public.mobile_json_is_uuid(payload->'tripId')
        and public.mobile_json_is_uuid(payload->'assetId')
        and public.mobile_json_is_integer(
          payload->'amountCents',
          1,
          9007199254740991
        )
        and jsonb_typeof(payload->'currency') = 'string'
        and public.mobile_is_iso_currency_code(payload->>'currency')
        and jsonb_typeof(payload->'spentAt') = 'string'
        and public.mobile_is_iso_instant(payload->>'spentAt')
        and jsonb_typeof(payload->'description') = 'string'
        and btrim(payload->>'description') <> ''
        and (
          not payload ? 'itineraryEntryId'
          or payload->'itineraryEntryId' = 'null'::jsonb
          or public.mobile_json_is_uuid(payload->'itineraryEntryId')
        )
        and (
          not payload ? 'bookingEntryId'
          or payload->'bookingEntryId' = 'null'::jsonb
          or public.mobile_json_is_uuid(payload->'bookingEntryId')
        )
        and not (
          coalesce(payload->'itineraryEntryId', 'null'::jsonb) <> 'null'::jsonb
          and coalesce(payload->'bookingEntryId', 'null'::jsonb) <> 'null'::jsonb
        );

    when 'trip.itinerary.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array['tripId','itemDate','startTime','title','notes','sortOrder']
        )
        and public.mobile_json_is_uuid(payload->'tripId')
        and jsonb_typeof(payload->'itemDate') = 'string'
        and public.mobile_is_iso_date(payload->>'itemDate')
        and (
          payload->'startTime' = 'null'::jsonb
          or (
            jsonb_typeof(payload->'startTime') = 'string'
            and payload->>'startTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          )
        )
        and jsonb_typeof(payload->'title') = 'string'
        and btrim(payload->>'title') <> ''
        and (
          payload->'notes' = 'null'::jsonb
          or jsonb_typeof(payload->'notes') = 'string'
        )
        and public.mobile_json_is_integer(
          payload->'sortOrder', -2147483648, 2147483647
        );

    when 'trip.booking.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'tripId','kind','title','confirmationNumber','address',
            'startsAt','endsAt','notes','sortOrder'
          ]
        )
        and public.mobile_json_is_uuid(payload->'tripId')
        and jsonb_typeof(payload->'kind') = 'string'
        and payload->>'kind' in ('flight','hotel','car','other')
        and jsonb_typeof(payload->'title') = 'string'
        and btrim(payload->>'title') <> ''
        and (
          payload->'confirmationNumber' = 'null'::jsonb
          or jsonb_typeof(payload->'confirmationNumber') = 'string'
        )
        and (
          payload->'address' = 'null'::jsonb
          or jsonb_typeof(payload->'address') = 'string'
        )
        and (
          payload->'startsAt' = 'null'::jsonb
          or (
            jsonb_typeof(payload->'startsAt') = 'string'
            and public.mobile_is_iso_instant(payload->>'startsAt')
          )
        )
        and (
          payload->'endsAt' = 'null'::jsonb
          or (
            jsonb_typeof(payload->'endsAt') = 'string'
            and public.mobile_is_iso_instant(payload->>'endsAt')
          )
        )
        and (
          payload->'startsAt' = 'null'::jsonb
          or payload->'endsAt' = 'null'::jsonb
          or (payload->>'endsAt')::timestamptz
             >= (payload->>'startsAt')::timestamptz
        )
        and (
          payload->'notes' = 'null'::jsonb
          or jsonb_typeof(payload->'notes') = 'string'
        )
        and public.mobile_json_is_integer(
          payload->'sortOrder', -2147483648, 2147483647
        );

    when 'trip.checklist.upsert' then
      return
        public.mobile_json_keys_valid(
          payload, array['tripId','label','checked','sortOrder']
        )
        and public.mobile_json_is_uuid(payload->'tripId')
        and jsonb_typeof(payload->'label') = 'string'
        and btrim(payload->>'label') <> ''
        and jsonb_typeof(payload->'checked') = 'boolean'
        and public.mobile_json_is_integer(
          payload->'sortOrder', -2147483648, 2147483647
        );

    when 'notification.read' then
      return
        public.mobile_json_keys_valid(payload, array['readAt'])
        and jsonb_typeof(payload->'readAt') = 'string'
        and public.mobile_is_iso_instant(payload->>'readAt');

    when 'settings.update' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[]::text[],
          array['displayName','appearance','notificationsEnabled']
        )
        and payload <> '{}'::jsonb
        and (
          not payload ? 'displayName'
          or (
            jsonb_typeof(payload->'displayName') = 'string'
            and btrim(payload->>'displayName') <> ''
          )
        )
        and (
          not payload ? 'appearance'
          or (
            jsonb_typeof(payload->'appearance') = 'string'
            and payload->>'appearance' in ('light','dark','system')
          )
        )
        and (
          not payload ? 'notificationsEnabled'
          or jsonb_typeof(payload->'notificationsEnabled') = 'boolean'
        );

    else
      return false;
  end case;
end;
$$;

create or replace function public.apply_household_operation(command jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  actor_id uuid;
  operation_id uuid;
  device_id uuid;
  household_id uuid;
  entity_id uuid;
  operation_type text;
  entity_type text;
  expected_entity_type text;
  payload jsonb;
  local_sequence bigint;
  base_revision bigint;
  next_revision bigint;
  server_sequence bigint;
  command_hash bytea;
  applied_at timestamptz := clock_timestamp();
  receipt public.operation_receipts%rowtype;
  current_entity public.household_entity_revisions%rowtype;
  has_current boolean := false;
  deleted_entity boolean := false;
  result jsonb;
  warning jsonb;
  details jsonb := '{}'::jsonb;
  change_kind text := 'upsert';
  old_row record;
  related_row record;
  row_count integer;
  desired_balance bigint;
  current_balance bigint;
  delta_cents bigint;
  amount_cents bigint;
  from_month integer;
  target_year integer;
  target_year_id uuid;
  target_month_id uuid;
  target_category_id uuid;
  target_asset_id uuid;
  target_trip_id uuid;
  previous_destination_id uuid;
  generated_transaction_id uuid;
  existing_limit_entity_id uuid;
  related_revision bigint;
  prior_limit bigint;
  blocking_months jsonb;
  detached_trip_ids jsonb;
  detached_trip_count integer := 0;
  from_currency text;
  to_currency text;
  expense_currency text;
begin
  if jsonb_typeof(command) <> 'object' then
    raise invalid_parameter_value using message = 'command must be an object';
  end if;

  if not public.mobile_json_is_uuid(command->'operationId') then
    raise invalid_parameter_value using message = 'operationId must be a UUID';
  end if;
  operation_id := (command->>'operationId')::uuid;

  if not public.mobile_json_is_uuid(command->'householdId') then
    raise invalid_parameter_value using message = 'householdId must be a UUID';
  end if;
  household_id := (command->>'householdId')::uuid;

  if not public.mobile_json_is_uuid(command->'deviceId') then
    raise invalid_parameter_value using message = 'deviceId must be a UUID';
  end if;
  device_id := (command->>'deviceId')::uuid;

  if not public.mobile_json_is_uuid(command->'entityId') then
    raise invalid_parameter_value using message = 'entityId must be a UUID';
  end if;
  entity_id := (command->>'entityId')::uuid;

  if not public.mobile_json_is_integer(
    command->'localSequence',
    0,
    9007199254740991
  ) then
    raise invalid_parameter_value
      using message = 'localSequence must be a nonnegative safe integer';
  end if;
  local_sequence := (command->>'localSequence')::bigint;

  if not (
    command->'baseRevision' = 'null'::jsonb
    or public.mobile_json_is_integer(
      command->'baseRevision',
      1,
      9007199254740991
    )
  ) then
    raise invalid_parameter_value
      using message = 'baseRevision must be null or a positive safe integer';
  end if;
  base_revision := case
    when command->'baseRevision' = 'null'::jsonb then null
    else (command->>'baseRevision')::bigint
  end;

  if jsonb_typeof(command->'type') <> 'string'
     or jsonb_typeof(command->'entityType') <> 'string'
     or jsonb_typeof(command->'enqueuedAt') <> 'string'
     or not public.mobile_is_iso_instant(command->>'enqueuedAt')
     or jsonb_typeof(command->'payload') <> 'object'
  then
    raise invalid_parameter_value using message = 'command envelope is invalid';
  end if;

  operation_type := command->>'type';
  entity_type := command->>'entityType';
  payload := command->'payload';

  actor_id := auth.uid();
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  if not exists (
    select 1
    from public.household_members hm
    where hm.household_id = household_id
      and hm.user_id = actor_id
  ) then
    raise insufficient_privilege
      using message = 'caller is not a member of the household';
  end if;

  -- Locking the trusted tenant row serializes all writes for this household.
  perform 1
  from public.households h
  where h.id = household_id
  for update;

  -- Hold the authorization row through commit so removal cannot race the
  -- SECURITY DEFINER mutation after this recheck.
  perform 1
  from public.household_members hm
  where hm.household_id = household_id
    and hm.user_id = actor_id
  for key share;

  if not found then
    raise insufficient_privilege
      using message = 'caller is not a member of the household';
  end if;

  command_hash := extensions.digest(command::text, 'sha256');

  select *
  into receipt
  from public.operation_receipts operation_receipt
  where operation_receipt.operation_id =
    operation_id;

  if found then
    if receipt.household_id <> household_id
       or receipt.command_hash <> command_hash then
      return public.mobile_rejected_result(
        operation_id,
        'operation_id_reused',
        'Operation ID was already used for a different command'
      );
    end if;

    if receipt.status = 'applied' then
      return jsonb_build_object(
        'status', 'duplicate',
        'operationId', operation_id,
        'serverSequence', receipt.server_sequence
      );
    end if;

    return receipt.result;
  end if;

  if not public.mobile_json_keys_valid(
    command,
    array[
      'schemaVersion','operationId','deviceId','localSequence','householdId',
      'type','entityType','entityId','baseRevision','enqueuedAt','payload'
    ]
  ) then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'invalid_command',
      'Command has missing or unexpected keys'
    );
  end if;

  if not public.mobile_json_is_integer(command->'schemaVersion', 1, 1) then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'unsupported_schema_version',
      'Unsupported operation schema version'
    );
  end if;

  expected_entity_type :=
    public.mobile_expected_entity_type(operation_type);
  if expected_entity_type is null then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'unsupported_operation',
      'Unsupported operation type'
    );
  end if;

  if entity_type <> expected_entity_type then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'entity_type_mismatch',
      'Entity type does not match operation type',
      jsonb_build_object('expectedEntityType', expected_entity_type)
    );
  end if;

  if not public.mobile_operation_payload_valid(operation_type, payload) then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'invalid_payload',
      'Operation payload is invalid for its type'
    );
  end if;

  -- Notifications originate outside this RPC in the reminder/activity jobs.
  -- Bootstrap their revision metadata on the first recipient read.
  if operation_type = 'notification.read'
     and not exists (
       select 1
       from public.household_entity_revisions er
       where er.household_id = household_id
         and er.entity_type = entity_type
         and er.entity_id = entity_id
     )
  then
    insert into public.household_entity_revisions (
      household_id,
      entity_type,
      entity_id,
      revision,
      deleted,
      last_operation_id,
      winner_type,
      winner_entity_type,
      winner_entity_id,
      applied_at
    )
    select
      n.household_id,
      'notification',
      n.id,
      n.revision,
      false,
      n.id,
      'notification.read',
      'notification',
      n.id,
      n.created_at
    from public.notifications n
    where n.id = entity_id
      and n.household_id = household_id
    on conflict do nothing;
  end if;

  select *
  into current_entity
  from public.household_entity_revisions er
  where er.household_id = household_id
    and er.entity_type = entity_type
    and er.entity_id = entity_id
  for update;
  has_current := found;

  if not has_current and base_revision is not null then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'entity_not_found',
      'The entity does not exist at the supplied revision'
    );
  end if;

  if has_current
     and base_revision is distinct from current_entity.revision then
    result := jsonb_build_object(
      'status', 'conflict',
      'operationId', operation_id,
      'reason', 'Entity was changed by another operation',
      'currentRevision', current_entity.revision,
      'winner', jsonb_build_object(
        'operationId', current_entity.last_operation_id,
        'type', current_entity.winner_type,
        'entityType', current_entity.winner_entity_type,
        'entityId', current_entity.winner_entity_id,
        'appliedAt', to_char(
          current_entity.applied_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
    );

    insert into public.operation_receipts (
      operation_id,
      household_id,
      actor_user_id,
      device_id,
      local_sequence,
      command_hash,
      status,
      result
    )
    values (
      operation_id,
      household_id,
      actor_id,
      device_id,
      local_sequence,
      command_hash,
      'conflict',
      result
    );

    return result;
  end if;

  next_revision := case
    when has_current then current_entity.revision + 1
    else 1
  end;

  case operation_type
    when 'calendar.event.upsert' then
      if payload->'ownerId' <> 'null'::jsonb
         and not exists (
           select 1
           from public.household_members hm
           where hm.household_id = household_id
             and hm.user_id = (payload->>'ownerId')::uuid
         )
      then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_owner',
          'Calendar owner must belong to the household'
        );
      end if;

      if has_current and not current_entity.deleted then
        update public.calendar_events
        set
          owner_id = case
            when payload->'ownerId' = 'null'::jsonb then null
            else (payload->>'ownerId')::uuid
          end,
          title = payload->>'title',
          note = case
            when payload->'note' = 'null'::jsonb then null
            else payload->>'note'
          end,
          all_day = (payload->>'allDay')::boolean,
          start_at = case
            when (payload->>'allDay')::boolean then null
            else (payload->>'startAt')::timestamptz
          end,
          end_at = case
            when (payload->>'allDay')::boolean then null
            else (payload->>'endAt')::timestamptz
          end,
          start_date = case
            when (payload->>'allDay')::boolean
              then (payload->>'startDate')::date
            else null
          end,
          end_date = case
            when (payload->>'allDay')::boolean
              then (payload->>'endDate')::date
            else null
          end,
          event_timezone = payload->>'timezone',
          recurrence_freq =
            (payload->>'recurrenceFrequency')::public.calendar_recurrence_freq,
          recurrence_until = case
            when payload->'recurrenceUntil' = 'null'::jsonb then null
            else (payload->>'recurrenceUntil')::date
          end,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id and calendar_events.household_id = household_id;
      else
        insert into public.calendar_events (
          id,
          household_id,
          owner_id,
          created_by,
          title,
          note,
          all_day,
          start_at,
          end_at,
          start_date,
          end_date,
          event_timezone,
          recurrence_freq,
          recurrence_until,
          revision
        )
        values (
          entity_id,
          household_id,
          case
            when payload->'ownerId' = 'null'::jsonb then null
            else (payload->>'ownerId')::uuid
          end,
          actor_id,
          payload->>'title',
          case
            when payload->'note' = 'null'::jsonb then null
            else payload->>'note'
          end,
          (payload->>'allDay')::boolean,
          case
            when (payload->>'allDay')::boolean then null
            else (payload->>'startAt')::timestamptz
          end,
          case
            when (payload->>'allDay')::boolean then null
            else (payload->>'endAt')::timestamptz
          end,
          case
            when (payload->>'allDay')::boolean
              then (payload->>'startDate')::date
            else null
          end,
          case
            when (payload->>'allDay')::boolean
              then (payload->>'endDate')::date
            else null
          end,
          payload->>'timezone',
          (payload->>'recurrenceFrequency')::public.calendar_recurrence_freq,
          case
            when payload->'recurrenceUntil' = 'null'::jsonb then null
            else (payload->>'recurrenceUntil')::date
          end,
          next_revision
        );
      end if;

      delete from public.calendar_event_reminders
      where event_id = entity_id;

      insert into public.calendar_event_reminders (
        household_id,
        event_id,
        preset,
        revision
      )
      select household_id, entity_id, value, next_revision
      from jsonb_array_elements_text(payload->'reminders');

    when 'calendar.event.delete' then
      delete from public.calendar_events
      where id = entity_id and calendar_events.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'grocery.list.upsert' then
      if has_current and not current_entity.deleted then
        update public.household_grocery_lists
        set
          name = payload->>'name',
          sort_order = (payload->>'sortOrder')::integer,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id
          and household_grocery_lists.household_id = household_id;
      else
        insert into public.household_grocery_lists (
          id, household_id, name, sort_order, created_by, revision
        )
        values (
          entity_id,
          household_id,
          payload->>'name',
          (payload->>'sortOrder')::integer,
          actor_id,
          next_revision
        );
      end if;

    when 'grocery.list.delete' then
      delete from public.household_grocery_lists
      where id = entity_id
        and household_grocery_lists.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'grocery.item.upsert' then
      if not exists (
        select 1
        from public.household_grocery_lists gl
        where gl.id = (payload->>'listId')::uuid
          and gl.household_id = household_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_list', 'Grocery list is not in the household'
        );
      end if;

      select *
      into old_row
      from public.household_grocery_items gi
      where gi.id = entity_id
        and gi.household_id = household_id;

      if found then
        update public.household_grocery_items
        set
          list_id = (payload->>'listId')::uuid,
          name = payload->>'name',
          quantity = case
            when payload->'quantity' = 'null'::jsonb then null
            else payload->>'quantity'
          end,
          checked = (payload->>'checked')::boolean,
          unit_price_cents = case
            when payload->'unitPriceCents' = 'null'::jsonb then null
            else (payload->>'unitPriceCents')::bigint
          end,
          sort_order = (payload->>'sortOrder')::integer,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;
      else
        insert into public.household_grocery_items (
          id,
          household_id,
          list_id,
          name,
          quantity,
          checked,
          unit_price_cents,
          sort_order,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          (payload->>'listId')::uuid,
          payload->>'name',
          case
            when payload->'quantity' = 'null'::jsonb then null
            else payload->>'quantity'
          end,
          (payload->>'checked')::boolean,
          case
            when payload->'unitPriceCents' = 'null'::jsonb then null
            else (payload->>'unitPriceCents')::bigint
          end,
          (payload->>'sortOrder')::integer,
          actor_id,
          next_revision
        );
      end if;

      if payload->'unitPriceCents' <> 'null'::jsonb
         and (payload->>'unitPriceCents')::bigint > 0
         and (
           old_row.id is null
           or old_row.unit_price_cents is distinct from
              (payload->>'unitPriceCents')::bigint
         )
      then
        insert into public.household_grocery_price_history (
          household_id,
          list_id,
          item_name,
          item_name_normalized,
          price_cents,
          recorded_by,
          recorded_at
        )
        values (
          household_id,
          (payload->>'listId')::uuid,
          payload->>'name',
          lower(btrim(payload->>'name')),
          (payload->>'unitPriceCents')::bigint,
          actor_id,
          applied_at
        );
      end if;

    when 'grocery.item.delete' then
      delete from public.household_grocery_items
      where id = entity_id
        and household_grocery_items.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'ledger.asset.upsert' then
      desired_balance := (payload->>'balanceCents')::bigint;
      select *
      into old_row
      from public.ledger_assets la
      where la.id = entity_id
        and la.household_id = household_id;

      if found then
        if old_row.currency_code <> payload->>'currency'
           and (
             exists (
               select 1
               from public.asset_postings ap
               where ap.asset_id = entity_id
             )
             or exists (
               select 1
               from public.ledger_transfers lt
               where lt.from_asset_id = entity_id
                  or lt.to_asset_id = entity_id
             )
             or exists (
               select 1
               from public.ledger_transfer_schedules lts
               where lts.from_asset_id = entity_id
                  or lts.to_asset_id = entity_id
             )
             or exists (
               select 1
               from public.ledger_transactions lt
               where lt.asset_id = entity_id
             )
             or exists (
               select 1
               from public.trip_expenses te
               where te.asset_id = entity_id
             )
           )
        then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'asset_currency_locked',
            'Asset currency cannot change after it is referenced'
          );
        end if;

        current_balance := public.mobile_asset_balance(entity_id);
        update public.ledger_assets
        set
          name = payload->>'name',
          kind = payload->>'kind',
          currency_code = payload->>'currency',
          sort_order = (payload->>'sortOrder')::integer,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;
        delta_cents := desired_balance - current_balance;
        perform public.mobile_add_posting(
          household_id,
          entity_id,
          operation_id,
          'ledger_asset',
          entity_id,
          'balance_adjustment',
          delta_cents,
          applied_at
        );
      else
        insert into public.ledger_assets (
          id,
          household_id,
          name,
          kind,
          currency_code,
          sort_order,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          payload->>'name',
          payload->>'kind',
          payload->>'currency',
          (payload->>'sortOrder')::integer,
          actor_id,
          next_revision
        );
        perform public.mobile_add_posting(
          household_id,
          entity_id,
          operation_id,
          'ledger_asset',
          entity_id,
          'opening',
          desired_balance,
          applied_at
        );
      end if;

      current_balance := public.mobile_asset_balance(entity_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', entity_id,
          'balanceCents', current_balance
        );
      end if;

    when 'ledger.asset.delete' then
      if exists (
        select 1
        from public.asset_postings ap
        where ap.asset_id = entity_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'asset_has_history',
          'Asset with posting history cannot be deleted'
        );
      end if;
      delete from public.ledger_assets
      where id = entity_id and ledger_assets.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'ledger.year.upsert' then
      target_year := (payload->>'year')::integer;
      if exists (
        select 1
        from public.ledger_years ly
        where ly.household_id = household_id
          and ly.year = target_year
          and ly.id <> entity_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'year_already_exists',
          'A different Ledger year entity already uses this year'
        );
      end if;

      select *
      into old_row
      from public.ledger_years ly
      where ly.id = entity_id
        and ly.household_id = household_id;

      if found then
        if old_row.year <> target_year then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'year_value_immutable',
            'A Ledger year number cannot be changed'
          );
        end if;
        update public.ledger_years
        set revision = next_revision, updated_at = applied_at
        where id = entity_id;
      else
        insert into public.ledger_years (
          id, household_id, year, created_by, revision
        )
        values (
          entity_id, household_id, target_year, actor_id, next_revision
        );
        insert into public.ledger_months (
          household_id, year_id, month, revision
        )
        select household_id, entity_id, month_number, 1
        from generate_series(1, 12) month_number;
      end if;

    when 'ledger.year.clear' then
      target_year := (payload->>'year')::integer;
      if payload->>'confirmation' <> target_year::text then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'typed_year_mismatch',
          'Typed year confirmation does not match the target year',
          jsonb_build_object('expectedYear', target_year)
        );
      end if;

      select *
      into old_row
      from public.ledger_years ly
      where ly.id = entity_id
        and ly.household_id = household_id;
      if not found or old_row.year <> target_year then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'year_not_found',
          'Ledger year does not match the target'
        );
      end if;

      for related_row in
        select
          'ledger_category'::text as entity_type,
          lc.id as entity_id,
          lc.revision as source_revision
        from public.ledger_categories lc
        where lc.year_id = entity_id
          and lc.household_id = household_id
        union all
        select
          'ledger_limit',
          lml.limit_entity_id,
          max(lml.revision)
        from public.ledger_month_limits lml
        join public.ledger_months lm on lm.id = lml.month_id
        where lm.year_id = entity_id
          and lml.household_id = household_id
        group by lml.limit_entity_id
        union all
        select
          'ledger_transaction',
          lt.id,
          lt.revision
        from public.ledger_transactions lt
        where lt.year_id = entity_id
          and lt.household_id = household_id
      loop
        perform public.mobile_record_cascade_deletion(
          household_id,
          related_row.entity_type,
          related_row.entity_id,
          related_row.source_revision,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
      end loop;

      select
        count(*)::integer,
        coalesce(jsonb_agg(lt.trip_expense_id order by lt.trip_expense_id),
          '[]'::jsonb)
      into detached_trip_count, detached_trip_ids
      from public.ledger_transactions lt
      where lt.year_id = entity_id
        and lt.trip_expense_id is not null;

      for old_row in
        select *
        from public.ledger_transactions lt
        where lt.year_id = entity_id
          and lt.trip_expense_id is null
      loop
        perform public.mobile_add_posting(
          household_id,
          old_row.asset_id,
          operation_id,
          'ledger_year_clear',
          old_row.id,
          'reversal',
          case
            when old_row.kind = 'income'
              then -old_row.amount_cents
            else old_row.amount_cents
          end,
          applied_at
        );
      end loop;

      update public.trip_expenses te
      set ledger_transaction_id = null, updated_at = applied_at
      where te.ledger_transaction_id in (
        select lt.id
        from public.ledger_transactions lt
        where lt.year_id = entity_id
          and lt.trip_expense_id is not null
      );

      delete from public.ledger_years where id = entity_id;
      deleted_entity := true;
      change_kind := 'clear';
      details := jsonb_build_object(
        'detachedTripExpenseCount', detached_trip_count,
        'detachedTripExpenseIds', detached_trip_ids
      );

    when 'ledger.category.upsert' then
      target_year_id := (payload->>'yearId')::uuid;
      from_month := (payload->>'fromMonth')::integer;
      if not exists (
        select 1
        from public.ledger_years ly
        where ly.id = target_year_id
          and ly.household_id = household_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_year',
          'Ledger year is not in the household'
        );
      end if;

      select *
      into old_row
      from public.ledger_categories lc
      where lc.id = entity_id
        and lc.household_id = household_id;

      if found then
        if old_row.year_id <> target_year_id
           or old_row.kind <> payload->>'kind' then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'category_identity_immutable',
            'Category year and kind cannot change'
          );
        end if;
        update public.ledger_categories
        set revision = next_revision, updated_at = applied_at
        where id = entity_id;
      else
        insert into public.ledger_categories (
          id,
          household_id,
          year_id,
          kind,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          target_year_id,
          payload->>'kind',
          actor_id,
          next_revision
        );
      end if;

      if payload->>'kind' = 'spending' then
        select lml.limit_entity_id
        into existing_limit_entity_id
        from public.ledger_month_limits lml
        where lml.category_id = entity_id
        order by (lml.limit_entity_id = entity_id), lml.id
        limit 1;

        select er.revision
        into related_revision
        from public.household_entity_revisions er
        where er.household_id = household_id
          and er.entity_type = 'ledger_limit'
          and er.entity_id = existing_limit_entity_id;

        if related_revision is not null
           and exists (
             select 1
             from public.ledger_months lm
             left join public.ledger_month_limits lml
               on lml.month_id = lm.id
              and lml.category_id = entity_id
             where lm.year_id = target_year_id
               and lm.month >= from_month
               and lml.id is null
           )
        then
          related_revision := public.mobile_record_cascade_update(
            household_id,
            'ledger_limit',
            existing_limit_entity_id,
            related_revision,
            operation_id,
            operation_type,
            entity_type,
            entity_id,
            applied_at
          );
        end if;
      end if;

      insert into public.ledger_month_categories (
        household_id,
        month_id,
        category_id,
        name,
        sort_order,
        revision
      )
      select
        household_id,
        lm.id,
        entity_id,
        payload->>'name',
        (payload->>'sortOrder')::integer,
        next_revision
      from public.ledger_months lm
      where lm.year_id = target_year_id
        and lm.month >= from_month
      on conflict (month_id, category_id) do update
      set
        name = excluded.name,
        sort_order = excluded.sort_order,
        revision = excluded.revision,
        updated_at = applied_at;

      if payload->>'kind' = 'spending' then
        select lml.limit_entity_id
        into existing_limit_entity_id
        from public.ledger_month_limits lml
        where lml.category_id = entity_id
        order by (lml.limit_entity_id = entity_id), lml.id
        limit 1;
        existing_limit_entity_id := coalesce(
          existing_limit_entity_id,
          entity_id
        );

        insert into public.ledger_month_limits (
          household_id,
          month_id,
          category_id,
          limit_entity_id,
          amount_cents,
          revision
        )
        select
          household_id,
          lm.id,
          entity_id,
          existing_limit_entity_id,
          null,
          coalesce(related_revision, next_revision)
        from public.ledger_months lm
        where lm.year_id = target_year_id
          and lm.month >= from_month
        on conflict (month_id, category_id) do nothing;
      end if;

    when 'ledger.category.delete' then
      from_month := (payload->>'fromMonth')::integer;
      select lc.year_id
      into target_year_id
      from public.ledger_categories lc
      where lc.id = entity_id
        and lc.household_id = household_id;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'category_not_found', 'Ledger category was not found'
        );
      end if;

      select coalesce(
        jsonb_agg(to_char(blocking.month, 'FM00') order by blocking.month),
        '[]'::jsonb
      )
      into blocking_months
      from (
        select distinct lm.month
        from public.ledger_transactions lt
        join public.ledger_months lm on lm.id = lt.month_id
        where lt.category_id = entity_id
          and lm.month >= from_month
      ) blocking;

      if jsonb_array_length(blocking_months) > 0 then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'category_has_spending',
          'Category has spending in selected or later months',
          jsonb_build_object('blockingMonths', blocking_months)
        );
      end if;

      select lml.limit_entity_id
      into existing_limit_entity_id
      from public.ledger_month_limits lml
      where lml.category_id = entity_id
      order by (lml.limit_entity_id = entity_id), lml.id
      limit 1;

      select er.revision
      into related_revision
      from public.household_entity_revisions er
      where er.household_id = household_id
        and er.entity_type = 'ledger_limit'
        and er.entity_id = existing_limit_entity_id;

      delete from public.ledger_month_categories lmc
      using public.ledger_months lm
      where lmc.month_id = lm.id
        and lmc.category_id = entity_id
        and lm.year_id = target_year_id
        and lm.month >= from_month;

      if not exists (
        select 1
        from public.ledger_month_categories lmc
        where lmc.category_id = entity_id
      ) then
        if related_revision is not null then
          perform public.mobile_record_cascade_deletion(
            household_id,
            'ledger_limit',
            existing_limit_entity_id,
            related_revision,
            operation_id,
            operation_type,
            entity_type,
            entity_id,
            applied_at
          );
        end if;
        delete from public.ledger_categories where id = entity_id;
        deleted_entity := true;
      else
        update public.ledger_categories
        set
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;

        if related_revision is not null then
          related_revision := public.mobile_record_cascade_update(
            household_id,
            'ledger_limit',
            existing_limit_entity_id,
            related_revision,
            operation_id,
            operation_type,
            entity_type,
            entity_id,
            applied_at
          );

          update public.ledger_month_limits
          set
            revision = related_revision,
            updated_at = applied_at
          where category_id = entity_id
            and limit_entity_id = existing_limit_entity_id;
        end if;
      end if;
      change_kind := 'delete';

    when 'ledger.limit.upsert' then
      target_category_id := (payload->>'categoryId')::uuid;
      from_month := (payload->>'fromMonth')::integer;
      select lc.year_id, lc.kind
      into target_year_id, from_currency
      from public.ledger_categories lc
      where lc.id = target_category_id
        and lc.household_id = household_id;
      if not found or from_currency <> 'spending' then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_spending_category',
          'Limits apply only to a household spending category'
        );
      end if;

      select lml.limit_entity_id
      into existing_limit_entity_id
      from public.ledger_month_limits lml
      where lml.category_id = target_category_id
      order by (lml.limit_entity_id = target_category_id), lml.id
      limit 1;

      if found
         and existing_limit_entity_id <> entity_id
         and (
           existing_limit_entity_id <> target_category_id
           or exists (
             select 1
             from public.household_entity_revisions er
             where er.household_id = household_id
               and er.entity_type = 'ledger_limit'
               and er.entity_id = existing_limit_entity_id
           )
         )
      then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'limit_identity_conflict',
          'Category limits already use a different entity identity',
          jsonb_build_object(
            'existingLimitEntityId', existing_limit_entity_id
          )
        );
      end if;

      if has_current and exists (
        select 1
        from public.ledger_month_limits lml
        where lml.limit_entity_id = entity_id
          and lml.category_id <> target_category_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'limit_category_immutable',
          'Limit entity cannot move to another category'
        );
      end if;

      if existing_limit_entity_id = target_category_id
         and existing_limit_entity_id <> entity_id
      then
        update public.ledger_month_limits
        set
          limit_entity_id = entity_id,
          updated_at = applied_at
        where category_id = target_category_id;
      end if;

      insert into public.ledger_month_limits (
        household_id,
        month_id,
        category_id,
        limit_entity_id,
        amount_cents,
        revision
      )
      select
        household_id,
        lm.id,
        target_category_id,
        entity_id,
        case
          when payload->'amountCents' = 'null'::jsonb then null
          else (payload->>'amountCents')::bigint
        end,
        next_revision
      from public.ledger_months lm
      join public.ledger_month_categories lmc
        on lmc.month_id = lm.id
       and lmc.category_id = target_category_id
      where lm.year_id = target_year_id
        and lm.month >= from_month
      on conflict (month_id, category_id) do update
      set
        limit_entity_id = excluded.limit_entity_id,
        amount_cents = excluded.amount_cents,
        revision = excluded.revision,
        updated_at = applied_at;

    when 'ledger.limit.delete' then
      target_category_id := (payload->>'categoryId')::uuid;
      from_month := (payload->>'fromMonth')::integer;
      select lc.year_id, lc.kind
      into target_year_id, from_currency
      from public.ledger_categories lc
      where lc.id = target_category_id
        and lc.household_id = household_id;
      if not found or from_currency <> 'spending' then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_spending_category',
          'Limits apply only to a household spending category'
        );
      end if;

      select lml.limit_entity_id
      into existing_limit_entity_id
      from public.ledger_month_limits lml
      where lml.category_id = target_category_id
      order by (lml.limit_entity_id = target_category_id), lml.id
      limit 1;

      if found
         and existing_limit_entity_id <> entity_id
         and (
           existing_limit_entity_id <> target_category_id
           or exists (
             select 1
             from public.household_entity_revisions er
             where er.household_id = household_id
               and er.entity_type = 'ledger_limit'
               and er.entity_id = existing_limit_entity_id
           )
         )
      then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'limit_identity_conflict',
          'Category limits already use a different entity identity',
          jsonb_build_object(
            'existingLimitEntityId', existing_limit_entity_id
          )
        );
      end if;

      if existing_limit_entity_id = target_category_id
         and existing_limit_entity_id <> entity_id
      then
        update public.ledger_month_limits
        set
          limit_entity_id = entity_id,
          updated_at = applied_at
        where category_id = target_category_id;
      end if;

      select lml.amount_cents
      into prior_limit
      from public.ledger_month_limits lml
      join public.ledger_months lm on lm.id = lml.month_id
      where lml.category_id = target_category_id
        and lm.month < from_month
      order by lm.month desc
      limit 1;

      update public.ledger_month_limits lml
      set
        amount_cents = prior_limit,
        limit_entity_id = entity_id,
        revision = next_revision,
        updated_at = applied_at
      from public.ledger_months lm
      where lml.month_id = lm.id
        and lml.category_id = target_category_id
        and lm.year_id = target_year_id
        and lm.month >= from_month;
      change_kind := 'delete';

    when 'ledger.transaction.upsert' then
      target_year_id := (payload->>'yearId')::uuid;
      from_month := (payload->>'month')::integer;
      target_category_id := (payload->>'categoryId')::uuid;
      target_asset_id := (payload->>'assetId')::uuid;
      amount_cents := (payload->>'amountCents')::bigint;

      select lm.id
      into target_month_id
      from public.ledger_months lm
      join public.ledger_years ly on ly.id = lm.year_id
      where lm.year_id = target_year_id
        and lm.month = from_month
        and ly.household_id = household_id
        and extract(year from (payload->>'occurredAt')::timestamptz) =
          ly.year
        and extract(month from (payload->>'occurredAt')::timestamptz) =
          lm.month;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_transaction_month',
          'Transaction time must match its household Ledger month'
        );
      end if;

      if not exists (
        select 1
        from public.ledger_month_categories lmc
        join public.ledger_categories lc on lc.id = lmc.category_id
        where lmc.month_id = target_month_id
          and lmc.category_id = target_category_id
          and lmc.household_id = household_id
          and lc.kind = payload->>'kind'
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_transaction_category',
          'Transaction category is not active for the month and kind'
        );
      end if;

      select currency_code
      into from_currency
      from public.ledger_assets la
      where la.id = target_asset_id
        and la.household_id = household_id;
      if not found or from_currency <> 'CAD' then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'ledger_requires_cad_asset',
          'Ledger transactions require a household CAD Asset'
        );
      end if;

      select *
      into old_row
      from public.ledger_transactions lt
      where lt.id = entity_id
        and lt.household_id = household_id;

      if found then
        if old_row.trip_expense_id is not null then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'trip_linked_transaction',
            'Trip-linked Ledger rows are edited through the Trip expense'
          );
        end if;
        perform public.mobile_add_posting(
          household_id,
          old_row.asset_id,
          operation_id,
          'ledger_transaction',
          entity_id,
          'previous_reversal',
          case
            when old_row.kind = 'income'
              then -old_row.amount_cents
            else old_row.amount_cents
          end,
          applied_at
        );

        update public.ledger_transactions
        set
          year_id = target_year_id,
          month_id = target_month_id,
          category_id = target_category_id,
          asset_id = target_asset_id,
          kind = payload->>'kind',
          amount_cents = amount_cents,
          occurred_at = (payload->>'occurredAt')::timestamptz,
          description = payload->>'description',
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;
      else
        insert into public.ledger_transactions (
          id,
          household_id,
          year_id,
          month_id,
          category_id,
          asset_id,
          kind,
          amount_cents,
          occurred_at,
          description,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          target_year_id,
          target_month_id,
          target_category_id,
          target_asset_id,
          payload->>'kind',
          amount_cents,
          (payload->>'occurredAt')::timestamptz,
          payload->>'description',
          actor_id,
          next_revision
        );
      end if;

      perform public.mobile_add_posting(
        household_id,
        target_asset_id,
        operation_id,
        'ledger_transaction',
        entity_id,
        'current_effect',
        case
          when payload->>'kind' = 'income' then amount_cents
          else -amount_cents
        end,
        (payload->>'occurredAt')::timestamptz
      );

      current_balance := public.mobile_asset_balance(target_asset_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', target_asset_id,
          'balanceCents', current_balance
        );
      end if;

    when 'ledger.transaction.delete' then
      select *
      into old_row
      from public.ledger_transactions lt
      where lt.id = entity_id
        and lt.household_id = household_id;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'transaction_not_found',
          'Ledger transaction was not found'
        );
      end if;
      if old_row.trip_expense_id is not null then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'trip_linked_transaction',
          'Trip-linked Ledger rows are deleted through the Trip expense'
        );
      end if;

      perform public.mobile_add_posting(
        household_id,
        old_row.asset_id,
        operation_id,
        'ledger_transaction',
        entity_id,
        'delete_reversal',
        case
          when old_row.kind = 'income' then -old_row.amount_cents
          else old_row.amount_cents
        end,
        applied_at
      );
      delete from public.ledger_transactions where id = entity_id;
      current_balance := public.mobile_asset_balance(old_row.asset_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', old_row.asset_id,
          'balanceCents', current_balance
        );
      end if;
      deleted_entity := true;
      change_kind := 'delete';

    when 'ledger.transfer.upsert' then
      select currency_code
      into from_currency
      from public.ledger_assets la
      where la.id = (payload->>'fromAssetId')::uuid
        and la.household_id = household_id;
      select currency_code
      into to_currency
      from public.ledger_assets la
      where la.id = (payload->>'toAssetId')::uuid
        and la.household_id = household_id;
      if from_currency is null or to_currency is null then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_transfer_asset',
          'Transfer Assets must belong to the household'
        );
      end if;
      if from_currency <> to_currency then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'currency_mismatch',
          'Asset transfers require matching currencies'
        );
      end if;

      select *
      into old_row
      from public.ledger_transfers lt
      where lt.id = entity_id
        and lt.household_id = household_id;
      if found then
        previous_destination_id := old_row.to_asset_id;
        perform public.mobile_add_posting(
          household_id, old_row.from_asset_id, operation_id,
          'ledger_transfer', entity_id, 'previous_source_reversal',
          old_row.amount_cents, applied_at
        );
        perform public.mobile_add_posting(
          household_id, old_row.to_asset_id, operation_id,
          'ledger_transfer', entity_id, 'previous_destination_reversal',
          -old_row.amount_cents, applied_at
        );
        update public.ledger_transfers
        set
          from_asset_id = (payload->>'fromAssetId')::uuid,
          to_asset_id = (payload->>'toAssetId')::uuid,
          amount_cents = (payload->>'amountCents')::bigint,
          occurred_at = (payload->>'occurredAt')::timestamptz,
          note = case
            when payload->'note' = 'null'::jsonb then null
            else payload->>'note'
          end,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;
      else
        insert into public.ledger_transfers (
          id,
          household_id,
          from_asset_id,
          to_asset_id,
          amount_cents,
          occurred_at,
          note,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          (payload->>'fromAssetId')::uuid,
          (payload->>'toAssetId')::uuid,
          (payload->>'amountCents')::bigint,
          (payload->>'occurredAt')::timestamptz,
          case
            when payload->'note' = 'null'::jsonb then null
            else payload->>'note'
          end,
          actor_id,
          next_revision
        );
      end if;

      perform public.mobile_add_posting(
        household_id,
        (payload->>'fromAssetId')::uuid,
        operation_id,
        'ledger_transfer',
        entity_id,
        'source',
        -(payload->>'amountCents')::bigint,
        (payload->>'occurredAt')::timestamptz
      );
      perform public.mobile_add_posting(
        household_id,
        (payload->>'toAssetId')::uuid,
        operation_id,
        'ledger_transfer',
        entity_id,
        'destination',
        (payload->>'amountCents')::bigint,
        (payload->>'occurredAt')::timestamptz
      );

      if previous_destination_id is not null then
        current_balance := public.mobile_asset_balance(previous_destination_id);
      end if;
      if previous_destination_id is not null and current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', previous_destination_id,
          'balanceCents', current_balance
        );
      end if;
      if warning is null then
        current_balance := public.mobile_asset_balance(
          (payload->>'fromAssetId')::uuid
        );
        if current_balance < 0 then
          warning := jsonb_build_object(
            'code', 'negative_asset_balance',
            'assetId', (payload->>'fromAssetId')::uuid,
            'balanceCents', current_balance
          );
        end if;
      end if;

    when 'ledger.transfer.delete' then
      select *
      into old_row
      from public.ledger_transfers lt
      where lt.id = entity_id
        and lt.household_id = household_id;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'transfer_not_found', 'Asset transfer was not found'
        );
      end if;
      perform public.mobile_add_posting(
        household_id, old_row.from_asset_id, operation_id,
        'ledger_transfer', entity_id, 'delete_source_reversal',
        old_row.amount_cents, applied_at
      );
      perform public.mobile_add_posting(
        household_id, old_row.to_asset_id, operation_id,
        'ledger_transfer', entity_id, 'delete_destination_reversal',
        -old_row.amount_cents, applied_at
      );
      current_balance := public.mobile_asset_balance(old_row.to_asset_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', old_row.to_asset_id,
          'balanceCents', current_balance
        );
      end if;
      delete from public.ledger_transfers where id = entity_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'ledger.schedule.upsert' then
      select currency_code
      into from_currency
      from public.ledger_assets la
      where la.id = (payload->>'fromAssetId')::uuid
        and la.household_id = household_id;
      select currency_code
      into to_currency
      from public.ledger_assets la
      where la.id = (payload->>'toAssetId')::uuid
        and la.household_id = household_id;
      if from_currency is null or to_currency is null
         or from_currency <> to_currency then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'currency_mismatch',
          'Scheduled transfers require household Assets in one currency'
        );
      end if;

      if has_current and not current_entity.deleted then
        update public.ledger_transfer_schedules
        set
          from_asset_id = (payload->>'fromAssetId')::uuid,
          to_asset_id = (payload->>'toAssetId')::uuid,
          amount_cents = (payload->>'amountCents')::bigint,
          frequency = payload->>'frequency',
          starts_at = (payload->>'startsAt')::timestamptz,
          timezone = payload->>'timezone',
          active = (payload->>'active')::boolean,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id
          and ledger_transfer_schedules.household_id = household_id;
      else
        insert into public.ledger_transfer_schedules (
          id,
          household_id,
          from_asset_id,
          to_asset_id,
          amount_cents,
          frequency,
          starts_at,
          timezone,
          active,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          (payload->>'fromAssetId')::uuid,
          (payload->>'toAssetId')::uuid,
          (payload->>'amountCents')::bigint,
          payload->>'frequency',
          (payload->>'startsAt')::timestamptz,
          payload->>'timezone',
          (payload->>'active')::boolean,
          actor_id,
          next_revision
        );
      end if;

    when 'ledger.schedule.delete' then
      if exists (
        select 1
        from public.ledger_transfers lt
        where lt.schedule_id = entity_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'schedule_has_transfers',
          'Schedule with generated transfers cannot be deleted'
        );
      end if;
      delete from public.ledger_transfer_schedules
      where id = entity_id
        and ledger_transfer_schedules.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'note.upsert' then
      if has_current and not current_entity.deleted then
        update public.household_notes
        set
          title = payload->>'title',
          document = payload->'document',
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id and household_notes.household_id = household_id;
      else
        insert into public.household_notes (
          id, household_id, title, document, created_by, revision
        )
        values (
          entity_id,
          household_id,
          payload->>'title',
          payload->'document',
          actor_id,
          next_revision
        );
      end if;

    when 'note.delete' then
      delete from public.household_notes
      where id = entity_id and household_notes.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'trip.upsert' then
      if has_current and not current_entity.deleted then
        if exists (
          select 1
          from public.household_trips ht
          join public.trip_expenses te on te.trip_id = ht.id
          where ht.id = entity_id
            and ht.household_id = household_id
            and ht.destination_currency <> payload->>'destinationCurrency'
            and te.currency_code <> 'CAD'
        ) then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'trip_currency_locked',
            'Trip destination currency cannot change after foreign expenses'
          );
        end if;

        update public.household_trips
        set
          name = payload->>'name',
          destination = payload->>'destination',
          destination_timezone = payload->>'timezone',
          destination_currency = payload->>'destinationCurrency',
          start_date = (payload->>'startDate')::date,
          end_date = (payload->>'endDate')::date,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id and household_trips.household_id = household_id;
      else
        insert into public.household_trips (
          id,
          household_id,
          name,
          destination,
          destination_timezone,
          destination_currency,
          start_date,
          end_date,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          payload->>'name',
          payload->>'destination',
          payload->>'timezone',
          payload->>'destinationCurrency',
          (payload->>'startDate')::date,
          (payload->>'endDate')::date,
          actor_id,
          next_revision
        );
      end if;

    when 'trip.delete' then
      for old_row in
        select *
        from public.trip_expenses te
        where te.trip_id = entity_id
          and te.household_id = household_id
      loop
        perform public.mobile_add_posting(
          household_id,
          old_row.asset_id,
          operation_id,
          'trip_delete',
          old_row.id,
          'expense_reversal',
          old_row.amount_cents,
          applied_at
        );

        perform public.mobile_record_cascade_deletion(
          household_id,
          'trip_expense',
          old_row.id,
          old_row.revision,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );

        if old_row.ledger_transaction_id is not null then
          select *
          into related_row
          from public.ledger_transactions lt
          where lt.id = old_row.ledger_transaction_id
            and lt.household_id = household_id;

          if found then
            perform public.mobile_record_cascade_deletion(
              household_id,
              'ledger_transaction',
              related_row.id,
              related_row.revision,
              operation_id,
              operation_type,
              entity_type,
              entity_id,
              applied_at
            );
          end if;
        end if;
      end loop;
      update public.trip_expenses
      set ledger_transaction_id = null
      where trip_id = entity_id;
      for old_row in
        select *
        from public.trip_itinerary_entries tie
        where tie.trip_id = entity_id
          and tie.household_id = household_id
      loop
        perform public.mobile_record_cascade_deletion(
          household_id,
          'trip_itinerary_entry',
          old_row.id,
          old_row.revision,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
      end loop;

      for old_row in
        select *
        from public.trip_booking_entries tbe
        where tbe.trip_id = entity_id
          and tbe.household_id = household_id
      loop
        perform public.mobile_record_cascade_deletion(
          household_id,
          'trip_booking_entry',
          old_row.id,
          old_row.revision,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
      end loop;

      for old_row in
        select *
        from public.trip_checklist_entries tce
        where tce.trip_id = entity_id
          and tce.household_id = household_id
      loop
        perform public.mobile_record_cascade_deletion(
          household_id,
          'trip_checklist_entry',
          old_row.id,
          old_row.revision,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
      end loop;

      delete from public.household_trips
      where id = entity_id and household_trips.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'trip.expense.upsert' then
      target_trip_id := (payload->>'tripId')::uuid;
      target_asset_id := (payload->>'assetId')::uuid;
      expense_currency := payload->>'currency';
      amount_cents := (payload->>'amountCents')::bigint;

      select *
      into related_row
      from public.household_trips ht
      where ht.id = target_trip_id
        and ht.household_id = household_id;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_trip', 'Trip is not in the household'
        );
      end if;
      if expense_currency <> 'CAD'
         and expense_currency <> related_row.destination_currency then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'unsupported_trip_currency',
          'Expense must use CAD or the Trip destination currency'
        );
      end if;

      select currency_code
      into from_currency
      from public.ledger_assets la
      where la.id = target_asset_id
        and la.household_id = household_id;
      if from_currency is null or from_currency <> expense_currency then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'currency_mismatch',
          'Expense currency must match the Asset currency'
        );
      end if;

      if coalesce(payload->'itineraryEntryId', 'null'::jsonb) <> 'null'::jsonb
         and not exists (
           select 1
           from public.trip_itinerary_entries tie
           where tie.id = (payload->>'itineraryEntryId')::uuid
             and tie.trip_id = target_trip_id
             and tie.household_id = household_id
         )
      then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_trip_expense_link',
          'Linked itinerary activity is not in this Trip'
        );
      end if;

      if coalesce(payload->'bookingEntryId', 'null'::jsonb) <> 'null'::jsonb
         and not exists (
           select 1
           from public.trip_booking_entries tbe
           where tbe.id = (payload->>'bookingEntryId')::uuid
             and tbe.trip_id = target_trip_id
             and tbe.household_id = household_id
         )
      then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_trip_expense_link',
          'Linked booking is not in this Trip'
        );
      end if;

      select *
      into old_row
      from public.trip_expenses te
      where te.id = entity_id
        and te.household_id = household_id;
      if found then
        perform public.mobile_add_posting(
          household_id,
          old_row.asset_id,
          operation_id,
          'trip_expense',
          entity_id,
          'previous_reversal',
          old_row.amount_cents,
          applied_at
        );
        if old_row.ledger_transaction_id is not null then
          select *
          into related_row
          from public.ledger_transactions lt
          where lt.id = old_row.ledger_transaction_id
            and lt.household_id = household_id;

          if found then
            perform public.mobile_record_cascade_deletion(
              household_id,
              'ledger_transaction',
              related_row.id,
              related_row.revision,
              operation_id,
              operation_type,
              entity_type,
              entity_id,
              applied_at
            );
          end if;

          update public.trip_expenses
          set ledger_transaction_id = null
          where id = entity_id;
          delete from public.ledger_transactions
          where id = old_row.ledger_transaction_id;
        end if;

        update public.trip_expenses
        set
          trip_id = target_trip_id,
          asset_id = target_asset_id,
          amount_cents = amount_cents,
          currency_code = expense_currency,
          spent_at = (payload->>'spentAt')::timestamptz,
          description = payload->>'description',
          itinerary_entry_id = case
            when coalesce(payload->'itineraryEntryId', 'null'::jsonb) = 'null'::jsonb then null
            else (payload->>'itineraryEntryId')::uuid
          end,
          booking_entry_id = case
            when coalesce(payload->'bookingEntryId', 'null'::jsonb) = 'null'::jsonb then null
            else (payload->>'bookingEntryId')::uuid
          end,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;
      else
        insert into public.trip_expenses (
          id,
          household_id,
          trip_id,
          asset_id,
          amount_cents,
          currency_code,
          spent_at,
          description,
          itinerary_entry_id,
          booking_entry_id,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          target_trip_id,
          target_asset_id,
          amount_cents,
          expense_currency,
          (payload->>'spentAt')::timestamptz,
          payload->>'description',
          case
            when coalesce(payload->'itineraryEntryId', 'null'::jsonb) = 'null'::jsonb then null
            else (payload->>'itineraryEntryId')::uuid
          end,
          case
            when coalesce(payload->'bookingEntryId', 'null'::jsonb) = 'null'::jsonb then null
            else (payload->>'bookingEntryId')::uuid
          end,
          actor_id,
          next_revision
        );
      end if;

      perform public.mobile_add_posting(
        household_id,
        target_asset_id,
        operation_id,
        'trip_expense',
        entity_id,
        'expense',
        -amount_cents,
        (payload->>'spentAt')::timestamptz
      );

      if expense_currency = 'CAD' then
        target_year := extract(
          year from (payload->>'spentAt')::timestamptz
        )::integer;
        from_month := extract(
          month from (payload->>'spentAt')::timestamptz
        )::integer;
        target_year_id := public.mobile_ensure_ledger_year(
          household_id,
          target_year,
          actor_id,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
        target_category_id := public.mobile_ensure_travel_category(
          household_id,
          target_year_id,
          actor_id,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
        select lm.id
        into target_month_id
        from public.ledger_months lm
        where lm.year_id = target_year_id and lm.month = from_month;

        generated_transaction_id := gen_random_uuid();
        insert into public.ledger_transactions (
          id,
          household_id,
          year_id,
          month_id,
          category_id,
          asset_id,
          kind,
          amount_cents,
          occurred_at,
          description,
          trip_expense_id,
          created_by,
          revision
        )
        values (
          generated_transaction_id,
          household_id,
          target_year_id,
          target_month_id,
          target_category_id,
          target_asset_id,
          'spending',
          amount_cents,
          (payload->>'spentAt')::timestamptz,
          payload->>'description',
          entity_id,
          actor_id,
          1
        );
        update public.trip_expenses
        set ledger_transaction_id = generated_transaction_id
        where id = entity_id;

        insert into public.household_entity_revisions (
          household_id,
          entity_type,
          entity_id,
          revision,
          deleted,
          last_operation_id,
          winner_type,
          winner_entity_type,
          winner_entity_id,
          applied_at
        )
        values (
          household_id,
          'ledger_transaction',
          generated_transaction_id,
          1,
          false,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
      end if;

      current_balance := public.mobile_asset_balance(target_asset_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', target_asset_id,
          'balanceCents', current_balance
        );
      end if;

    when 'trip.expense.delete' then
      select *
      into old_row
      from public.trip_expenses te
      where te.id = entity_id
        and te.household_id = household_id;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'trip_expense_not_found',
          'Trip expense was not found'
        );
      end if;
      perform public.mobile_add_posting(
        household_id,
        old_row.asset_id,
        operation_id,
        'trip_expense',
        entity_id,
        'delete_reversal',
        old_row.amount_cents,
        applied_at
      );
      if old_row.ledger_transaction_id is not null then
        select *
        into related_row
        from public.ledger_transactions lt
        where lt.id = old_row.ledger_transaction_id
          and lt.household_id = household_id;

        if found then
          perform public.mobile_record_cascade_deletion(
            household_id,
            'ledger_transaction',
            related_row.id,
            related_row.revision,
            operation_id,
            operation_type,
            entity_type,
            entity_id,
            applied_at
          );
        end if;

        update public.trip_expenses
        set ledger_transaction_id = null
        where id = entity_id;
        delete from public.ledger_transactions
        where id = old_row.ledger_transaction_id;
      end if;
      delete from public.trip_expenses where id = entity_id;
      current_balance := public.mobile_asset_balance(old_row.asset_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', old_row.asset_id,
          'balanceCents', current_balance
        );
      end if;
      deleted_entity := true;
      change_kind := 'delete';

    when 'trip.itinerary.upsert' then
      if not exists (
        select 1
        from public.household_trips ht
        where ht.id = (payload->>'tripId')::uuid
          and ht.household_id = household_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_trip', 'Trip is not in the household'
        );
      end if;

      if has_current and not current_entity.deleted then
        update public.trip_itinerary_entries
        set
          trip_id = (payload->>'tripId')::uuid,
          item_date = (payload->>'itemDate')::date,
          start_time = case
            when payload->'startTime' = 'null'::jsonb then null
            else (payload->>'startTime')::time
          end,
          title = payload->>'title',
          notes = case
            when payload->'notes' = 'null'::jsonb then null
            else payload->>'notes'
          end,
          sort_order = (payload->>'sortOrder')::integer,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id
          and trip_itinerary_entries.household_id = household_id;
      else
        insert into public.trip_itinerary_entries (
          id, household_id, trip_id, item_date, start_time, title, notes,
          sort_order, created_by, revision
        )
        values (
          entity_id,
          household_id,
          (payload->>'tripId')::uuid,
          (payload->>'itemDate')::date,
          case
            when payload->'startTime' = 'null'::jsonb then null
            else (payload->>'startTime')::time
          end,
          payload->>'title',
          case
            when payload->'notes' = 'null'::jsonb then null
            else payload->>'notes'
          end,
          (payload->>'sortOrder')::integer,
          actor_id,
          next_revision
        );
      end if;

    when 'trip.itinerary.delete' then
      delete from public.trip_itinerary_entries
      where id = entity_id
        and trip_itinerary_entries.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'trip.booking.upsert' then
      if not exists (
        select 1
        from public.household_trips ht
        where ht.id = (payload->>'tripId')::uuid
          and ht.household_id = household_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_trip', 'Trip is not in the household'
        );
      end if;

      if has_current and not current_entity.deleted then
        update public.trip_booking_entries
        set
          trip_id = (payload->>'tripId')::uuid,
          kind = payload->>'kind',
          title = payload->>'title',
          confirmation_number = case
            when payload->'confirmationNumber' = 'null'::jsonb then null
            else payload->>'confirmationNumber'
          end,
          address = case
            when payload->'address' = 'null'::jsonb then null
            else payload->>'address'
          end,
          starts_at = case
            when payload->'startsAt' = 'null'::jsonb then null
            else (payload->>'startsAt')::timestamptz
          end,
          ends_at = case
            when payload->'endsAt' = 'null'::jsonb then null
            else (payload->>'endsAt')::timestamptz
          end,
          notes = case
            when payload->'notes' = 'null'::jsonb then null
            else payload->>'notes'
          end,
          sort_order = (payload->>'sortOrder')::integer,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id
          and trip_booking_entries.household_id = household_id;
      else
        insert into public.trip_booking_entries (
          id, household_id, trip_id, kind, title, confirmation_number,
          address, starts_at, ends_at, notes, sort_order, created_by, revision
        )
        values (
          entity_id,
          household_id,
          (payload->>'tripId')::uuid,
          payload->>'kind',
          payload->>'title',
          case
            when payload->'confirmationNumber' = 'null'::jsonb then null
            else payload->>'confirmationNumber'
          end,
          case
            when payload->'address' = 'null'::jsonb then null
            else payload->>'address'
          end,
          case
            when payload->'startsAt' = 'null'::jsonb then null
            else (payload->>'startsAt')::timestamptz
          end,
          case
            when payload->'endsAt' = 'null'::jsonb then null
            else (payload->>'endsAt')::timestamptz
          end,
          case
            when payload->'notes' = 'null'::jsonb then null
            else payload->>'notes'
          end,
          (payload->>'sortOrder')::integer,
          actor_id,
          next_revision
        );
      end if;

    when 'trip.booking.delete' then
      delete from public.trip_booking_entries
      where id = entity_id
        and trip_booking_entries.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'trip.checklist.upsert' then
      if not exists (
        select 1
        from public.household_trips ht
        where ht.id = (payload->>'tripId')::uuid
          and ht.household_id = household_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_trip', 'Trip is not in the household'
        );
      end if;

      if has_current and not current_entity.deleted then
        update public.trip_checklist_entries
        set
          trip_id = (payload->>'tripId')::uuid,
          label = payload->>'label',
          checked = (payload->>'checked')::boolean,
          sort_order = (payload->>'sortOrder')::integer,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id
          and trip_checklist_entries.household_id = household_id;
      else
        insert into public.trip_checklist_entries (
          id, household_id, trip_id, label, checked, sort_order,
          created_by, revision
        )
        values (
          entity_id,
          household_id,
          (payload->>'tripId')::uuid,
          payload->>'label',
          (payload->>'checked')::boolean,
          (payload->>'sortOrder')::integer,
          actor_id,
          next_revision
        );
      end if;

    when 'trip.checklist.delete' then
      delete from public.trip_checklist_entries
      where id = entity_id
        and trip_checklist_entries.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'notification.read' then
      update public.notifications
      set
        read_at = (payload->>'readAt')::timestamptz,
        revision = next_revision,
        updated_at = applied_at
      where id = entity_id
        and notifications.household_id = household_id
        and recipient_user_id = actor_id;
      get diagnostics row_count = row_count;
      if row_count <> 1 then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'notification_not_owned',
          'Only the recipient can read a notification'
        );
      end if;
      change_kind := 'read';

    when 'settings.update' then
      if entity_id <> actor_id then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'settings_not_owned',
          'Settings can only be changed by their user'
        );
      end if;

      select *
      into old_row
      from public.profiles p
      where p.user_id = actor_id;
      if found then
        update public.profiles
        set
          display_name = case
            when payload ? 'displayName' then payload->>'displayName'
            else old_row.display_name
          end,
          appearance = case
            when payload ? 'appearance' then payload->>'appearance'
            else old_row.appearance
          end,
          notifications_enabled = case
            when payload ? 'notificationsEnabled'
              then (payload->>'notificationsEnabled')::boolean
            else old_row.notifications_enabled
          end,
          revision = next_revision,
          updated_at = applied_at
        where user_id = actor_id;
      else
        if not payload ? 'displayName' then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'display_name_required',
            'A first settings update requires displayName'
          );
        end if;
        insert into public.profiles (
          user_id,
          display_name,
          appearance,
          notifications_enabled,
          revision
        )
        values (
          actor_id,
          payload->>'displayName',
          coalesce(payload->>'appearance', 'system'),
          coalesce(
            (payload->>'notificationsEnabled')::boolean,
            true
          ),
          next_revision
        );
      end if;

    else
      raise internal_error using message = 'validated operation was not dispatched';
  end case;

  insert into public.household_entity_revisions (
    household_id,
    entity_type,
    entity_id,
    revision,
    deleted,
    last_operation_id,
    winner_type,
    winner_entity_type,
    winner_entity_id,
    applied_at
  )
  values (
    household_id,
    entity_type,
    entity_id,
    next_revision,
    deleted_entity,
    operation_id,
    operation_type,
    entity_type,
    entity_id,
    applied_at
  )
  on conflict on constraint household_entity_revisions_pkey do update
  set
    revision = excluded.revision,
    deleted = excluded.deleted,
    last_operation_id = excluded.last_operation_id,
    winner_type = excluded.winner_type,
    winner_entity_type = excluded.winner_entity_type,
    winner_entity_id = excluded.winner_entity_id,
    applied_at = excluded.applied_at;

  if deleted_entity then
    insert into public.household_tombstones (
      household_id,
      entity_type,
      entity_id,
      revision,
      operation_id,
      deleted_at
    )
    values (
      household_id,
      entity_type,
      entity_id,
      next_revision,
      operation_id,
      applied_at
    )
    on conflict on constraint
      household_tombstones_household_id_entity_type_entity_id_key
    do update
    set
      revision = excluded.revision,
      operation_id = excluded.operation_id,
      deleted_at = excluded.deleted_at;
  else
    delete from public.household_tombstones ht
    where ht.household_id = household_id
      and ht.entity_type = entity_type
      and ht.entity_id = entity_id;
  end if;

  select coalesce(max(operation_receipt.server_sequence), 0) + 1
  into server_sequence
  from public.operation_receipts operation_receipt
  where operation_receipt.household_id = household_id;

  result := jsonb_build_object(
    'status', 'applied',
    'operationId', operation_id,
    'serverSequence', server_sequence,
    'entityRevision', next_revision
  );
  if warning is not null then
    result := result || jsonb_build_object('warning', warning);
  end if;
  if details <> '{}'::jsonb then
    result := result || jsonb_build_object('details', details);
  end if;

  insert into public.operation_receipts (
    operation_id,
    household_id,
    actor_user_id,
    device_id,
    local_sequence,
    command_hash,
    server_sequence,
    status,
    result,
    created_at
  )
  values (
    operation_id,
    household_id,
    actor_id,
    device_id,
    local_sequence,
    command_hash,
    server_sequence,
    'applied',
    result,
    applied_at
  );

  insert into public.household_change_log (
    household_id,
    server_sequence,
    operation_id,
    operation_type,
    entity_type,
    entity_id,
    entity_revision,
    change_kind,
    changed_at
  )
  values (
    household_id,
    server_sequence,
    operation_id,
    operation_type,
    entity_type,
    entity_id,
    next_revision,
    change_kind,
    applied_at
  );

  return result;
end;
$$;
