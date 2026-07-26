begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
set local timezone = 'UTC';

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at
)
values
  (
    '90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'trip-content-a@example.test', '', now(), now(), now()
  ),
  (
    '90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'trip-content-outsider@example.test', '', now(), now(), now()
  );

insert into public.households (id, name, owner_user_id)
values
  (
    '91000000-0000-4000-8000-000000000001', 'Trip content household A',
    '90000000-0000-4000-8000-000000000001'
  ),
  (
    '91000000-0000-4000-8000-000000000002', 'Trip content household B',
    '90000000-0000-4000-8000-000000000002'
  );

insert into public.household_members (id, household_id, user_id, display_name, member_role)
values
  (
    '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001', 'Member A', 'owner'
  ),
  (
    '92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000002', 'Outsider', 'owner'
  );

insert into public.household_trips (
  id, household_id, name, destination, destination_timezone,
  destination_currency, start_date, end_date, created_by
)
values (
  '93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
  'London', 'London, UK', 'Europe/London', 'GBP', '2026-08-01', '2026-08-10',
  '90000000-0000-4000-8000-000000000001'
);

insert into public.ledger_assets (
  id, household_id, name, kind, currency_code, created_by
)
values (
  '93000000-0000-4000-8000-000000000010',
  '91000000-0000-4000-8000-000000000001',
  'Travel card', 'credit', 'CAD',
  '90000000-0000-4000-8000-000000000001'
);

create function pg_temp.operation_command(
  operation_id uuid,
  household_id uuid,
  operation_type text,
  entity_type text,
  entity_id uuid,
  base_revision bigint,
  payload jsonb,
  local_sequence bigint default 0
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'operationId', operation_id,
    'deviceId', '20000000-0000-4000-8000-000000000001',
    'localSequence', local_sequence,
    'householdId', household_id,
    'type', operation_type,
    'entityType', entity_type,
    'entityId', entity_id,
    'baseRevision', base_revision,
    'enqueuedAt', '2026-07-26T00:00:00.000Z',
    'payload', payload
  );
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000000',
        '91000000-0000-4000-8000-000000000001',
        'trip.upsert',
        'trip',
        '93000000-0000-4000-8000-000000000002',
        null,
        jsonb_build_object(
          'name', 'Cascade trip',
          'destination', 'Tokyo',
          'timezone', 'Asia/Tokyo',
          'startDate', '2026-09-01',
          'endDate', '2026-09-05',
          'destinationCurrency', 'JPY'
        ),
        0
      )
    )->>'status'
  ),
  'applied',
  'seed: the cascade trip is created through the operation queue so it has a tracked revision'
);

-- Itinerary -----------------------------------------------------------

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000001',
        '91000000-0000-4000-8000-000000000001',
        'trip.itinerary.upsert',
        'trip_itinerary_entry',
        '95000000-0000-4000-8000-000000000001',
        null,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000001',
          'itemDate', '2026-08-02',
          'startTime', '09:30',
          'title', 'Tower of London tour',
          'notes', null,
          'sortOrder', 0
        ),
        1
      )
    )->>'status'
  ),
  'applied',
  'a new Itinerary entry applies'
);

select is(
  (
    select row(item_date, start_time, title, sort_order)::text
    from public.trip_itinerary_entries
    where id = '95000000-0000-4000-8000-000000000001'
  ),
  (select row('2026-08-02'::date, '09:30'::time, 'Tower of London tour', 0)::text),
  'the Itinerary entry stores its date, time, title, and sort order'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000002',
        '91000000-0000-4000-8000-000000000001',
        'trip.itinerary.upsert',
        'trip_itinerary_entry',
        '95000000-0000-4000-8000-000000000001',
        1,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000001',
          'itemDate', '2026-08-02',
          'startTime', null,
          'title', 'Tower of London tour (rescheduled)',
          'notes', 'Meet at the main gate',
          'sortOrder', 1
        ),
        2
      )
    )->>'status'
  ),
  'applied',
  'editing an Itinerary entry with the correct baseRevision applies'
);

select is(
  (
    select row(start_time, title, notes, revision)::text
    from public.trip_itinerary_entries
    where id = '95000000-0000-4000-8000-000000000001'
  ),
  (select row(null::time, 'Tower of London tour (rescheduled)', 'Meet at the main gate', 2::bigint)::text),
  'the edit clears start_time to null and advances the revision'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000003',
        '91000000-0000-4000-8000-000000000001',
        'trip.itinerary.upsert',
        'trip_itinerary_entry',
        '95000000-0000-4000-8000-000000000002',
        null,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000099',
          'itemDate', '2026-08-02',
          'startTime', null,
          'title', 'Orphan entry',
          'notes', null,
          'sortOrder', 0
        ),
        3
      )
    )->>'code'
  ),
  'invalid_trip',
  'an Itinerary entry for a trip outside the household is rejected'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000004',
        '91000000-0000-4000-8000-000000000001',
        'trip.itinerary.delete',
        'trip_itinerary_entry',
        '95000000-0000-4000-8000-000000000001',
        2,
        '{}'::jsonb,
        4
      )
    )->>'status'
  ),
  'applied',
  'deleting an Itinerary entry applies'
);

select ok(
  not exists (
    select 1 from public.trip_itinerary_entries
    where id = '95000000-0000-4000-8000-000000000001'
  ),
  'the deleted Itinerary entry row is gone'
);

-- Bookings --------------------------------------------------------------

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000005',
        '91000000-0000-4000-8000-000000000001',
        'trip.booking.upsert',
        'trip_booking_entry',
        '95000000-0000-4000-8000-000000000003',
        null,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000001',
          'kind', 'hotel',
          'title', 'Park Hyatt London',
          'confirmationNumber', 'ABC123',
          'address', '1 Hyde Park, London',
          'startsAt', '2026-08-01T15:00:00.000Z',
          'endsAt', '2026-08-10T11:00:00.000Z',
          'notes', null,
          'sortOrder', 0
        ),
        5
      )
    )->>'status'
  ),
  'applied',
  'a new hotel Booking applies'
);

select is(
  (
    select row(kind, title, confirmation_number)::text
    from public.trip_booking_entries
    where id = '95000000-0000-4000-8000-000000000003'
  ),
  (select row('hotel', 'Park Hyatt London', 'ABC123')::text),
  'the Booking stores its kind, title, and confirmation number'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000006',
        '91000000-0000-4000-8000-000000000001',
        'trip.booking.upsert',
        'trip_booking_entry',
        '95000000-0000-4000-8000-000000000004',
        null,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000001',
          'kind', 'submarine',
          'title', 'Not a real kind',
          'confirmationNumber', null,
          'address', null,
          'startsAt', null,
          'endsAt', null,
          'notes', null,
          'sortOrder', 0
        ),
        6
      )
    )->>'code'
  ),
  'invalid_payload',
  'a Booking with an unsupported kind is rejected'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000007',
        '91000000-0000-4000-8000-000000000001',
        'trip.booking.delete',
        'trip_booking_entry',
        '95000000-0000-4000-8000-000000000003',
        1,
        '{}'::jsonb,
        7
      )
    )->>'status'
  ),
  'applied',
  'deleting a Booking applies'
);

-- Checklist ---------------------------------------------------------------

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000008',
        '91000000-0000-4000-8000-000000000001',
        'trip.checklist.upsert',
        'trip_checklist_entry',
        '95000000-0000-4000-8000-000000000005',
        null,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000001',
          'label', 'Passports',
          'checked', false,
          'sortOrder', 0
        ),
        8
      )
    )->>'status'
  ),
  'applied',
  'a new Checklist entry applies'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000009',
        '91000000-0000-4000-8000-000000000001',
        'trip.checklist.upsert',
        'trip_checklist_entry',
        '95000000-0000-4000-8000-000000000005',
        1,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000001',
          'label', 'Passports',
          'checked', true,
          'sortOrder', 0
        ),
        9
      )
    )->>'status'
  ),
  'applied',
  'toggling a Checklist entry checked applies'
);

select ok(
  (
    select checked from public.trip_checklist_entries
    where id = '95000000-0000-4000-8000-000000000005'
  ),
  'the Checklist entry is now checked'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-00000000000a',
        '91000000-0000-4000-8000-000000000001',
        'trip.checklist.delete',
        'trip_checklist_entry',
        '95000000-0000-4000-8000-000000000005',
        2,
        '{}'::jsonb,
        10
      )
    )->>'status'
  ),
  'applied',
  'deleting a Checklist entry applies'
);

-- Trip deletion cascades to all three content tables -----------------------

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-00000000000b',
        '91000000-0000-4000-8000-000000000001',
        'trip.itinerary.upsert',
        'trip_itinerary_entry',
        '95000000-0000-4000-8000-000000000006',
        null,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000002',
          'itemDate', '2026-09-02',
          'startTime', null,
          'title', 'Cascade itinerary',
          'notes', null,
          'sortOrder', 0
        ),
        11
      )
    )->>'status'
  ),
  'applied',
  'seed: Itinerary entry on the cascade trip'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-00000000000c',
        '91000000-0000-4000-8000-000000000001',
        'trip.booking.upsert',
        'trip_booking_entry',
        '95000000-0000-4000-8000-000000000007',
        null,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000002',
          'kind', 'flight',
          'title', 'Cascade booking',
          'confirmationNumber', null,
          'address', null,
          'startsAt', null,
          'endsAt', null,
          'notes', null,
          'sortOrder', 0
        ),
        12
      )
    )->>'status'
  ),
  'applied',
  'seed: Booking on the cascade trip'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-00000000000d',
        '91000000-0000-4000-8000-000000000001',
        'trip.checklist.upsert',
        'trip_checklist_entry',
        '95000000-0000-4000-8000-000000000008',
        null,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000002',
          'label', 'Cascade checklist',
          'checked', false,
          'sortOrder', 0
        ),
        13
      )
    )->>'status'
  ),
  'applied',
  'seed: Checklist entry on the cascade trip'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-00000000000e',
        '91000000-0000-4000-8000-000000000001',
        'trip.expense.upsert',
        'trip_expense',
        '95000000-0000-4000-8000-000000000009',
        null,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000002',
          'assetId', '93000000-0000-4000-8000-000000000010',
          'amountCents', 4500,
          'currency', 'CAD',
          'spentAt', '2026-09-02T12:00:00.000Z',
          'description', 'Airport transfer',
          'itineraryEntryId', null,
          'bookingEntryId', '95000000-0000-4000-8000-000000000007'
        ),
        14
      )
    )->>'status'
  ),
  'applied',
  'a Trip expense can link to one Booking'
);

select is(
  (
    select booking_entry_id::text
    from public.trip_expenses
    where id = '95000000-0000-4000-8000-000000000009'
  ),
  '95000000-0000-4000-8000-000000000007',
  'the Trip expense stores its Booking link'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-00000000000f',
        '91000000-0000-4000-8000-000000000001',
        'trip.expense.upsert',
        'trip_expense',
        '95000000-0000-4000-8000-00000000000a',
        null,
        jsonb_build_object(
          'tripId', '93000000-0000-4000-8000-000000000001',
          'assetId', '93000000-0000-4000-8000-000000000010',
          'amountCents', 100,
          'currency', 'CAD',
          'spentAt', '2026-08-02T12:00:00.000Z',
          'description', 'Wrong Trip link',
          'itineraryEntryId', null,
          'bookingEntryId', '95000000-0000-4000-8000-000000000007'
        ),
        15
      )
    )->>'code'
  ),
  'invalid_trip_expense_link',
  'an expense cannot link to a Booking from another Trip'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000010',
        '91000000-0000-4000-8000-000000000001',
        'trip.expense.delete',
        'trip_expense',
        '95000000-0000-4000-8000-000000000009',
        1,
        '{}'::jsonb,
        16
      )
    )->>'status'
  ),
  'applied',
  'deleting the linked Trip expense applies'
);

select ok(
  exists (
    select 1
    from public.household_entity_revisions
    where household_id = '91000000-0000-4000-8000-000000000001'
      and entity_type = 'trip_expense'
      and entity_id = '95000000-0000-4000-8000-000000000009'
      and deleted
      and winner_type = 'trip.expense.delete'
  ),
  'Trip expense deletion records its winning tombstone'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '94000000-0000-4000-8000-000000000011',
        '91000000-0000-4000-8000-000000000001',
        'trip.delete',
        'trip',
        '93000000-0000-4000-8000-000000000002',
        1,
        '{}'::jsonb,
        17
      )
    )->>'status'
  ),
  'applied',
  'deleting the trip applies'
);

select ok(
  not exists (select 1 from public.trip_itinerary_entries where trip_id = '93000000-0000-4000-8000-000000000002')
  and not exists (select 1 from public.trip_booking_entries where trip_id = '93000000-0000-4000-8000-000000000002')
  and not exists (select 1 from public.trip_checklist_entries where trip_id = '93000000-0000-4000-8000-000000000002'),
  'trip deletion cascades to remove all three content tables'' rows'
);

select is(
  (
    select count(*)::integer
    from public.household_entity_revisions
    where household_id = '91000000-0000-4000-8000-000000000001'
      and entity_id in (
        '95000000-0000-4000-8000-000000000006',
        '95000000-0000-4000-8000-000000000007',
        '95000000-0000-4000-8000-000000000008'
      )
      and deleted
  ),
  3,
  'trip deletion records a deleted entity revision for each cascaded content row'
);

-- RLS -----------------------------------------------------------------

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);

select is(
  (
    select count(*)::integer
    from public.trip_booking_entries
    where trip_id = '93000000-0000-4000-8000-000000000001'
  ),
  0,
  'an outsider cannot read another household''s Trip Booking entries through RLS'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);

select is(
  (
    select count(*)::integer
    from public.trip_booking_entries
    where trip_id = '93000000-0000-4000-8000-000000000001'
  ),
  0,
  'the household member still sees zero Bookings on the London trip (only the hotel, which was deleted, ever existed)'
);

-- Realtime -------------------------------------------------------------

select ok(
  (
    select count(*)::integer
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in (
        'trip_itinerary_entries', 'trip_booking_entries', 'trip_checklist_entries'
      )
  ) = 3,
  'all three Trip content tables are in the Realtime publication'
);

select * from finish();
rollback;
