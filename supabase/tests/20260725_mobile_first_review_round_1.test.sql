begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
set local timezone = 'UTC';

select no_plan();

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'authenticated',
    'authenticated',
    'review-a@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'authenticated',
    'authenticated',
    'review-b@example.test',
    '',
    now(),
    now(),
    now()
  );

insert into public.households (id, name, owner_user_id)
values
  (
    '10000000-0000-4000-8000-000000000101',
    'Review household A',
    '00000000-0000-4000-8000-000000000101'
  ),
  (
    '10000000-0000-4000-8000-000000000102',
    'Review household B',
    '00000000-0000-4000-8000-000000000102'
  );

insert into public.household_members (
  id,
  household_id,
  user_id,
  display_name,
  member_role
)
values
  (
    '11000000-0000-4000-8000-000000000101',
    '10000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000101',
    'Review member A',
    'owner'
  ),
  (
    '11000000-0000-4000-8000-000000000102',
    '10000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000102',
    'Review member B',
    'owner'
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
    'deviceId', '20000000-0000-4000-8000-000000000101',
    'localSequence', local_sequence,
    'householdId', household_id,
    'type', operation_type,
    'entityType', entity_type,
    'entityId', entity_id,
    'baseRevision', base_revision,
    'enqueuedAt', '2026-07-25T05:00:00.000Z',
    'payload', payload
  );
$$;

-- The upgrade harness preloads this row before the mobile-first migration.
-- A normal reset omits the fixture and reports these two assertions as skipped.
select * from skip(
  'run mobile_first_calendar_upgrade.sh to exercise the Calendar upgrade path',
  2
)
where not exists (
  select 1
  from public.calendar_events
  where id = '31000000-0000-4000-8000-000000000201'
);

select is(
  (
    select revision
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000201'
      and entity_type = 'calendar_event'
      and entity_id = '31000000-0000-4000-8000-000000000201'
      and not deleted
  ),
  1::bigint,
  'the mobile migration backfills a pre-existing Calendar revision'
)
where exists (
  select 1
  from public.calendar_events
  where id = '31000000-0000-4000-8000-000000000201'
);

select is(
  (
    select count(*)::integer
    from unnest(array['households', 'household_members'])
      as tenancy_table(table_name)
    where has_table_privilege(
      'authenticated',
      'public.' || table_name,
      'INSERT'
    )
       or has_table_privilege(
         'authenticated',
         'public.' || table_name,
         'UPDATE'
       )
       or has_table_privilege(
         'authenticated',
         'public.' || table_name,
         'DELETE'
       )
       or has_table_privilege(
         'authenticated',
         'public.' || table_name,
         'TRUNCATE'
       )
  ),
  0,
  'authenticated has no DML or TRUNCATE grant on extended tenancy tables'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.mobile_record_cascade_update(uuid,text,uuid,bigint,uuid,text,text,uuid,timestamptz)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.mobile_record_cascade_update(uuid,text,uuid,bigint,uuid,text,text,uuid,timestamptz)',
    'EXECUTE'
  )
  and not exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) privilege
    where p.oid =
      'public.mobile_record_cascade_update(uuid,text,uuid,bigint,uuid,text,text,uuid,timestamptz)'::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'the cascade-update helper is private to trusted database code'
);

select throws_ok(
  $$
    insert into public.household_members (
      id,
      household_id,
      user_id,
      display_name,
      member_role
    )
    values (
      '11000000-0000-4000-8000-000000000103',
      '10000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000101',
      'Duplicate household member',
      'member'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "household_members_user_id_key"',
  'one auth user cannot acquire a second household revision stream'
);

delete from public.household_members
where id = '11000000-0000-4000-8000-000000000103';

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000101',
  true
);

insert into public.calendar_events (
  id,
  household_id,
  created_by,
  title,
  note,
  all_day,
  start_at,
  end_at,
  event_timezone,
  recurrence_freq,
  revision
)
values (
  '31000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000101',
  'Legacy Calendar event',
  null,
  false,
  '2026-08-01T17:00:00.000Z',
  '2026-08-01T18:00:00.000Z',
  'America/Vancouver',
  'none',
  1
);

select is(
  (
    select revision
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'calendar_event'
      and entity_id = '31000000-0000-4000-8000-000000000101'
      and not deleted
  ),
  1::bigint,
  'a privileged post-migration Calendar insert enters the RPC revision model'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000201',
  true
);

select is(
  (
    select public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000201',
        '10000000-0000-4000-8000-000000000201',
        'calendar.event.upsert',
        'calendar_event',
        '31000000-0000-4000-8000-000000000201',
        1,
        jsonb_build_object(
          'title', 'Calendar before mobile updated',
          'note', null,
          'ownerId', null,
          'allDay', false,
          'startAt', '2026-08-02T17:00:00.000Z',
          'endAt', '2026-08-02T18:30:00.000Z',
          'timezone', 'UTC',
          'recurrenceFrequency', 'none',
          'recurrenceUntil', null,
          'reminders', jsonb_build_array()
        ),
        201
      )
    )->>'status'
    from public.calendar_events ce
    where ce.id = '31000000-0000-4000-8000-000000000201'
  ),
  'applied',
  'a pre-existing Calendar row accepts a baseRevision 1 RPC update'
)
where exists (
  select 1
  from public.calendar_events
  where id = '31000000-0000-4000-8000-000000000201'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000101',
  true
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000101',
        '10000000-0000-4000-8000-000000000101',
        'calendar.event.upsert',
        'calendar_event',
        '31000000-0000-4000-8000-000000000101',
        1,
        jsonb_build_object(
          'title', 'Legacy Calendar event updated',
          'note', null,
          'ownerId', null,
          'allDay', false,
          'startAt', '2026-08-01T17:00:00.000Z',
          'endAt', '2026-08-01T18:30:00.000Z',
          'timezone', 'America/Vancouver',
          'recurrenceFrequency', 'none',
          'recurrenceUntil', null,
          'reminders', jsonb_build_array()
        ),
        1
      )
    )->>'status'
  ),
  'applied',
  'a privileged post-migration Calendar event accepts a baseRevision 1 RPC update'
);

select is(
  (
    select revision
    from public.calendar_events
    where id = '31000000-0000-4000-8000-000000000101'
  ),
  2::bigint,
  'the post-migration Calendar row and operation metadata advance together'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000102',
        '10000000-0000-4000-8000-000000000101',
        'settings.update',
        'settings',
        '00000000-0000-4000-8000-000000000101',
        null,
        '{"displayName":"Review member A","appearance":"dark"}',
        2
      )
    )->>'status'
  ),
  'applied',
  'the sole household owns the first global settings revision'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000103',
        '10000000-0000-4000-8000-000000000101',
        'settings.update',
        'settings',
        '00000000-0000-4000-8000-000000000101',
        1,
        '{"appearance":"light"}',
        3
      )
    )->>'status'
  ),
  'applied',
  'global settings revisions remain monotonic in the sole household'
);

select is(
  (
    select revision
    from public.profiles
    where user_id = '00000000-0000-4000-8000-000000000101'
  ),
  2::bigint,
  'the global profile stores the sole settings stream revision'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000104',
        '10000000-0000-4000-8000-000000000101',
        'ledger.year.upsert',
        'ledger_year',
        '30000000-0000-4000-8000-000000000101',
        null,
        '{"year":2026}',
        4
      )
    )->>'status'
  ),
  'applied',
  'the review fixture creates a Ledger year'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000105',
        '10000000-0000-4000-8000-000000000101',
        'ledger.category.upsert',
        'ledger_category',
        '30000000-0000-4000-8000-000000000102',
        null,
        jsonb_build_object(
          'yearId', '30000000-0000-4000-8000-000000000101',
          'fromMonth', 1,
          'name', 'Review spending',
          'kind', 'spending',
          'sortOrder', 0
        ),
        5
      )
    )->>'status'
  ),
  'applied',
  'the review fixture creates a spending category'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000106',
        '10000000-0000-4000-8000-000000000101',
        'ledger.limit.upsert',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000103',
        null,
        jsonb_build_object(
          'categoryId', '30000000-0000-4000-8000-000000000102',
          'fromMonth', 6,
          'amountCents', 10000
        ),
        6
      )
    )->>'status'
  ),
  'applied',
  'the first category limit establishes its stable entity identity'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000107',
        '10000000-0000-4000-8000-000000000101',
        'ledger.limit.upsert',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000104',
        null,
        jsonb_build_object(
          'categoryId', '30000000-0000-4000-8000-000000000102',
          'fromMonth', 6,
          'amountCents', 20000
        ),
        7
      )
    )->>'code'
  ),
  'limit_identity_conflict',
  'a different limit entity ID cannot bypass the category revision stream'
);

select is(
  (
    select count(*)::integer
    from public.ledger_month_limits
    where category_id = '30000000-0000-4000-8000-000000000102'
      and limit_entity_id = '30000000-0000-4000-8000-000000000103'
  ),
  12,
  'a rejected competing limit leaves the established identity unchanged'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000133',
        '10000000-0000-4000-8000-000000000101',
        'ledger.limit.delete',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000104',
        null,
        jsonb_build_object(
          'categoryId', '30000000-0000-4000-8000-000000000102',
          'fromMonth', 6
        ),
        33
      )
    )->>'code'
  ),
  'limit_identity_conflict',
  'a different limit entity ID cannot bypass deletion conflict checks'
);

select is(
  (
    select count(*)::integer
    from public.ledger_month_limits
    where category_id = '30000000-0000-4000-8000-000000000102'
      and limit_entity_id = '30000000-0000-4000-8000-000000000103'
  ),
  12,
  'a rejected competing limit deletion preserves all established rows'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000130',
        '10000000-0000-4000-8000-000000000101',
        'ledger.category.delete',
        'ledger_category',
        '30000000-0000-4000-8000-000000000102',
        1,
        '{"fromMonth":9}',
        30
      )
    )->>'status'
  ),
  'applied',
  'a category tail can be removed after its limit identity is established'
);

select ok(
  (
    select
      revision = 2
      and not deleted
      and winner_type = 'ledger.category.delete'
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_limit'
      and entity_id = '30000000-0000-4000-8000-000000000103'
  ),
  'partial category deletion advances the established limit revision'
);

select is(
  (
    select count(*)::integer
    from public.household_tombstones
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_limit'
      and entity_id = '30000000-0000-4000-8000-000000000103'
  ),
  0,
  'partial category deletion keeps the surviving limit stream live'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000140',
        '10000000-0000-4000-8000-000000000101',
        'ledger.limit.upsert',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000103',
        1,
        jsonb_build_object(
          'categoryId', '30000000-0000-4000-8000-000000000102',
          'fromMonth', 9,
          'amountCents', 30000
        ),
        40
      )
    )->>'status'
  ),
  'conflict',
  'a queued limit update conflicts with a winning partial category deletion'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000131',
        '10000000-0000-4000-8000-000000000101',
        'ledger.category.upsert',
        'ledger_category',
        '30000000-0000-4000-8000-000000000102',
        2,
        jsonb_build_object(
          'yearId', '30000000-0000-4000-8000-000000000101',
          'fromMonth', 9,
          'name', 'Review spending',
          'kind', 'spending',
          'sortOrder', 0
        ),
        31
      )
    )->>'status'
  ),
  'applied',
  'category restoration keeps using its established limit stream'
);

select is(
  (
    select count(*)::integer
    from public.ledger_month_limits
    where category_id = '30000000-0000-4000-8000-000000000102'
      and limit_entity_id = '30000000-0000-4000-8000-000000000103'
  ),
  12,
  'category restoration cannot reintroduce a second limit identity'
);

select ok(
  (
    select
      revision = 3
      and not deleted
      and winner_type = 'ledger.category.upsert'
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_limit'
      and entity_id = '30000000-0000-4000-8000-000000000103'
  ),
  'category restoration advances the established limit revision'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000143',
        '10000000-0000-4000-8000-000000000101',
        'ledger.limit.delete',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000103',
        2,
        jsonb_build_object(
          'categoryId', '30000000-0000-4000-8000-000000000102',
          'fromMonth', 9
        ),
        43
      )
    )->>'status'
  ),
  'conflict',
  'a queued limit delete conflicts with the winning category restoration'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000108',
        '10000000-0000-4000-8000-000000000101',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000105',
        null,
        '{"name":"Scheduled source","kind":"cash","currency":"CAD","balanceCents":0,"sortOrder":0}',
        8
      )
    )->>'status'
  ),
  'applied',
  'a zero-balance schedule source Asset can be created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000109',
        '10000000-0000-4000-8000-000000000101',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000106',
        null,
        '{"name":"Scheduled destination","kind":"cash","currency":"CAD","balanceCents":0,"sortOrder":1}',
        9
      )
    )->>'status'
  ),
  'applied',
  'a zero-balance schedule destination Asset can be created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000110',
        '10000000-0000-4000-8000-000000000101',
        'ledger.schedule.upsert',
        'ledger_schedule',
        '30000000-0000-4000-8000-000000000107',
        null,
        jsonb_build_object(
          'fromAssetId', '30000000-0000-4000-8000-000000000105',
          'toAssetId', '30000000-0000-4000-8000-000000000106',
          'amountCents', 100,
          'frequency', 'monthly',
          'startsAt', '2026-09-01T16:00:00.000Z',
          'timezone', 'America/Vancouver',
          'active', true
        ),
        10
      )
    )->>'status'
  ),
  'applied',
  'a zero-posting schedule establishes an Asset currency dependency'
);

select is(
  (
    select count(*)::integer
    from public.asset_postings
    where asset_id = '30000000-0000-4000-8000-000000000105'
  ),
  0,
  'the schedule currency-lock fixture has no posting dependency'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000111',
        '10000000-0000-4000-8000-000000000101',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000105',
        1,
        '{"name":"Scheduled source","kind":"cash","currency":"USD","balanceCents":0,"sortOrder":0}',
        11
      )
    )->>'code'
  ),
  'asset_currency_locked',
  'a referenced zero-posting Asset cannot change currency'
);

select is(
  (
    select currency_code
    from public.ledger_assets
    where id = '30000000-0000-4000-8000-000000000105'
  ),
  'CAD',
  'the rejected Asset currency change preserves its schedule invariant'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000112',
        '10000000-0000-4000-8000-000000000101',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000108',
        null,
        '{"name":"CAD Trip cash","kind":"cash","currency":"CAD","balanceCents":2000,"sortOrder":2}',
        12
      )
    )->>'status'
  ),
  'applied',
  'a CAD Trip Asset can be created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000113',
        '10000000-0000-4000-8000-000000000101',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000109',
        null,
        '{"name":"GBP Trip cash","kind":"cash","currency":"GBP","balanceCents":2000,"sortOrder":3}',
        13
      )
    )->>'status'
  ),
  'applied',
  'a foreign Trip Asset can be created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000114',
        '10000000-0000-4000-8000-000000000101',
        'trip.upsert',
        'trip',
        '30000000-0000-4000-8000-000000000110',
        null,
        jsonb_build_object(
          'name', 'London review',
          'destination', 'London, UK',
          'timezone', 'Europe/London',
          'startDate', '2027-08-01',
          'endDate', '2027-12-31',
          'destinationCurrency', 'GBP'
        ),
        14
      )
    )->>'status'
  ),
  'applied',
  'the review fixture creates a GBP Trip'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000115',
        '10000000-0000-4000-8000-000000000101',
        'trip.expense.upsert',
        'trip_expense',
        '30000000-0000-4000-8000-000000000111',
        null,
        jsonb_build_object(
          'tripId', '30000000-0000-4000-8000-000000000110',
          'assetId', '30000000-0000-4000-8000-000000000108',
          'amountCents', 200,
          'currency', 'CAD',
          'spentAt', '2027-08-03T12:00:00.000Z',
          'description', 'CAD expense to edit'
        ),
        15
      )
    )->>'status'
  ),
  'applied',
  'a first CAD Trip expense creates a generated Ledger child'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000116',
        '10000000-0000-4000-8000-000000000101',
        'trip.expense.upsert',
        'trip_expense',
        '30000000-0000-4000-8000-000000000112',
        null,
        jsonb_build_object(
          'tripId', '30000000-0000-4000-8000-000000000110',
          'assetId', '30000000-0000-4000-8000-000000000108',
          'amountCents', 100,
          'currency', 'CAD',
          'spentAt', '2027-08-04T12:00:00.000Z',
          'description', 'CAD expense to delete'
        ),
        16
      )
    )->>'status'
  ),
  'applied',
  'a second CAD Trip expense creates another generated Ledger child'
);

select set_config(
  'test.edit_child',
  (
    select ledger_transaction_id::text
    from public.trip_expenses
    where id = '30000000-0000-4000-8000-000000000111'
  ),
  true
);

select set_config(
  'test.delete_child',
  (
    select ledger_transaction_id::text
    from public.trip_expenses
    where id = '30000000-0000-4000-8000-000000000112'
  ),
  true
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000117',
        '10000000-0000-4000-8000-000000000101',
        'trip.expense.upsert',
        'trip_expense',
        '30000000-0000-4000-8000-000000000113',
        null,
        jsonb_build_object(
          'tripId', '30000000-0000-4000-8000-000000000110',
          'assetId', '30000000-0000-4000-8000-000000000109',
          'amountCents', 300,
          'currency', 'GBP',
          'spentAt', '2027-08-05T12:00:00.000Z',
          'description', 'Foreign expense'
        ),
        17
      )
    )->>'status'
  ),
  'applied',
  'a foreign expense establishes the Trip destination-currency invariant'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000118',
        '10000000-0000-4000-8000-000000000101',
        'trip.upsert',
        'trip',
        '30000000-0000-4000-8000-000000000110',
        1,
        jsonb_build_object(
          'name', 'London review',
          'destination', 'London, UK',
          'timezone', 'Europe/London',
          'startDate', '2027-08-01',
          'endDate', '2027-12-31',
          'destinationCurrency', 'EUR'
        ),
        18
      )
    )->>'code'
  ),
  'trip_currency_locked',
  'a Trip with foreign expenses cannot change destination currency'
);

select is(
  (
    select destination_currency
    from public.household_trips
    where id = '30000000-0000-4000-8000-000000000110'
  ),
  'GBP',
  'the rejected Trip update preserves its foreign-expense invariant'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000119',
        '10000000-0000-4000-8000-000000000101',
        'trip.expense.upsert',
        'trip_expense',
        '30000000-0000-4000-8000-000000000111',
        1,
        jsonb_build_object(
          'tripId', '30000000-0000-4000-8000-000000000110',
          'assetId', '30000000-0000-4000-8000-000000000108',
          'amountCents', 250,
          'currency', 'CAD',
          'spentAt', '2027-08-06T12:00:00.000Z',
          'description', 'Edited CAD expense'
        ),
        19
      )
    )->>'status'
  ),
  'applied',
  'editing a CAD Trip expense replaces its generated Ledger child'
);

select ok(
  (
    select deleted and revision = 2
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_transaction'
      and entity_id = current_setting('test.edit_child')::uuid
  ),
  'Trip expense edit marks the removed Ledger child revision deleted'
);

select ok(
  exists (
    select 1
    from public.household_tombstones
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_transaction'
      and entity_id = current_setting('test.edit_child')::uuid
      and operation_id = '40000000-0000-4000-8000-000000000119'
      and revision = 2
  ),
  'Trip expense edit leaves a durable Ledger-child tombstone'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000120',
        '10000000-0000-4000-8000-000000000101',
        'ledger.transaction.upsert',
        'ledger_transaction',
        current_setting('test.edit_child')::uuid,
        1,
        jsonb_build_object(
          'yearId', (
            select id
            from public.ledger_years
            where household_id = '10000000-0000-4000-8000-000000000101'
              and year = 2027
          ),
          'month', 8,
          'categoryId', (
            select id
            from public.ledger_categories
            where household_id = '10000000-0000-4000-8000-000000000101'
              and system_key = 'travel'
          ),
          'assetId', '30000000-0000-4000-8000-000000000108',
          'kind', 'spending',
          'amountCents', 200,
          'occurredAt', '2027-08-03T12:00:00.000Z',
          'description', 'Queued before expense edit'
        ),
        20
      )
    )->>'status'
  ),
  'conflict',
  'a queued Ledger-child write conflicts with the winning expense edit'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000121',
        '10000000-0000-4000-8000-000000000101',
        'trip.expense.delete',
        'trip_expense',
        '30000000-0000-4000-8000-000000000112',
        1,
        '{}',
        21
      )
    )->>'status'
  ),
  'applied',
  'deleting a CAD Trip expense removes its generated Ledger child'
);

select ok(
  (
    select deleted and revision = 2
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_transaction'
      and entity_id = current_setting('test.delete_child')::uuid
  ),
  'Trip expense delete marks the removed Ledger child revision deleted'
);

select ok(
  exists (
    select 1
    from public.household_tombstones
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_transaction'
      and entity_id = current_setting('test.delete_child')::uuid
      and operation_id = '40000000-0000-4000-8000-000000000121'
      and revision = 2
  ),
  'Trip expense delete leaves a durable Ledger-child tombstone'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000122',
        '10000000-0000-4000-8000-000000000101',
        'ledger.transaction.upsert',
        'ledger_transaction',
        current_setting('test.delete_child')::uuid,
        1,
        jsonb_build_object(
          'yearId', (
            select id
            from public.ledger_years
            where household_id = '10000000-0000-4000-8000-000000000101'
              and year = 2027
          ),
          'month', 8,
          'categoryId', (
            select id
            from public.ledger_categories
            where household_id = '10000000-0000-4000-8000-000000000101'
              and system_key = 'travel'
          ),
          'assetId', '30000000-0000-4000-8000-000000000108',
          'kind', 'spending',
          'amountCents', 100,
          'occurredAt', '2027-08-04T12:00:00.000Z',
          'description', 'Queued before expense deletion'
        ),
        22
      )
    )->>'status'
  ),
  'conflict',
  'a queued Ledger-child write conflicts with the winning expense deletion'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000134',
        '10000000-0000-4000-8000-000000000101',
        'ledger.limit.delete',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000118',
        null,
        jsonb_build_object(
          'categoryId', (
            select id
            from public.ledger_categories
            where household_id = '10000000-0000-4000-8000-000000000101'
              and system_key = 'travel'
          ),
          'fromMonth', 1
        ),
        34
      )
    )->>'status'
  ),
  'applied',
  'a first limit delete claims the Travel category placeholder identity'
);

select is(
  (
    select count(*)::integer
    from public.ledger_month_limits lml
    join public.ledger_categories lc on lc.id = lml.category_id
    where lc.household_id = '10000000-0000-4000-8000-000000000101'
      and lc.system_key = 'travel'
      and lml.limit_entity_id = '30000000-0000-4000-8000-000000000118'
  ),
  12,
  'the first limit delete migrates every placeholder month to one identity'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000132',
        '10000000-0000-4000-8000-000000000101',
        'ledger.limit.upsert',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000118',
        1,
        jsonb_build_object(
          'categoryId', (
            select id
            from public.ledger_categories
            where household_id = '10000000-0000-4000-8000-000000000101'
              and system_key = 'travel'
          ),
          'fromMonth', 1,
          'amountCents', 500
        ),
        32
      )
    )->>'status'
  ),
  'applied',
  'the claimed Travel limit identity can set an explicit amount'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000123',
        '10000000-0000-4000-8000-000000000101',
        'ledger.category.delete',
        'ledger_category',
        (
          select id
          from public.ledger_categories
          where household_id = '10000000-0000-4000-8000-000000000101'
            and system_key = 'travel'
        ),
        1,
        '{"fromMonth":9}',
        23
      )
    )->>'status'
  ),
  'applied',
  'a spending-free tail of the system Travel category can be removed'
);

select is(
  (
    select count(*)::integer
    from public.ledger_months lm
    left join public.ledger_month_categories lmc
      on lmc.month_id = lm.id
     and lmc.category_id = (
       select id
       from public.ledger_categories
       where household_id = '10000000-0000-4000-8000-000000000101'
         and system_key = 'travel'
     )
    where lm.year_id = (
      select id
      from public.ledger_years
      where household_id = '10000000-0000-4000-8000-000000000101'
        and year = 2027
    )
      and lm.month between 9 and 12
      and lmc.id is null
  ),
  4,
  'the Travel repair fixture is missing its September-December configuration'
);

select set_config(
  'test.travel_category_revision_after_delete',
  (
    select revision::text
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_category'
      and entity_id = (
        select id
        from public.ledger_categories
        where household_id = '10000000-0000-4000-8000-000000000101'
          and system_key = 'travel'
      )
  ),
  true
);

select set_config(
  'test.travel_limit_revision_after_delete',
  (
    select revision::text
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_limit'
      and entity_id = '30000000-0000-4000-8000-000000000118'
  ),
  true
);

select lives_ok(
  $$
    select public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000124',
        '10000000-0000-4000-8000-000000000101',
        'trip.expense.upsert',
        'trip_expense',
        '30000000-0000-4000-8000-000000000114',
        null,
        jsonb_build_object(
          'tripId', '30000000-0000-4000-8000-000000000110',
          'assetId', '30000000-0000-4000-8000-000000000108',
          'amountCents', 150,
          'currency', 'CAD',
          'spentAt', '2027-10-03T12:00:00.000Z',
          'description', 'Restored Travel month'
        ),
        24
      )
    )
  $$,
  'a later CAD Trip expense repairs partial Travel configuration'
);

select is(
  (
    select status
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000124'
  ),
  'applied',
  'the CAD expense is recorded after idempotent Travel repair'
);

select ok(
  (
    select
      revision =
        current_setting('test.travel_category_revision_after_delete')::bigint + 1
      and winner_type = 'trip.expense.upsert'
      and winner_entity_type = 'trip_expense'
      and winner_entity_id = '30000000-0000-4000-8000-000000000114'
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_category'
      and entity_id = (
        select id
        from public.ledger_categories
        where household_id = '10000000-0000-4000-8000-000000000101'
          and system_key = 'travel'
      )
  ),
  'Travel repair advances the category revision under the expense winner'
);

select ok(
  (
    select
      revision =
        current_setting('test.travel_limit_revision_after_delete')::bigint + 1
      and winner_type = 'trip.expense.upsert'
      and winner_entity_type = 'trip_expense'
      and winner_entity_id = '30000000-0000-4000-8000-000000000114'
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_limit'
      and entity_id = '30000000-0000-4000-8000-000000000118'
  ),
  'Travel repair advances the established limit revision under the expense winner'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000141',
        '10000000-0000-4000-8000-000000000101',
        'ledger.category.upsert',
        'ledger_category',
        (
          select id
          from public.ledger_categories
          where household_id = '10000000-0000-4000-8000-000000000101'
            and system_key = 'travel'
        ),
        current_setting('test.travel_category_revision_after_delete')::bigint,
        jsonb_build_object(
          'yearId', (
            select year_id
            from public.ledger_categories
            where household_id = '10000000-0000-4000-8000-000000000101'
              and system_key = 'travel'
          ),
          'fromMonth', 9,
          'name', 'Queued Travel rename',
          'kind', 'spending',
          'sortOrder', 1
        ),
        41
      )
    )->>'status'
  ),
  'conflict',
  'a queued category mutation conflicts with the winning Travel repair'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000142',
        '10000000-0000-4000-8000-000000000101',
        'ledger.limit.upsert',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000118',
        current_setting('test.travel_limit_revision_after_delete')::bigint,
        jsonb_build_object(
          'categoryId', (
            select id
            from public.ledger_categories
            where household_id = '10000000-0000-4000-8000-000000000101'
              and system_key = 'travel'
          ),
          'fromMonth', 9,
          'amountCents', 900
        ),
        42
      )
    )->>'status'
  ),
  'conflict',
  'a queued limit mutation conflicts with the winning Travel repair'
);

select ok(
  exists (
    select 1
    from public.ledger_month_limits lml
    join public.ledger_months lm on lm.id = lml.month_id
    join public.ledger_categories lc on lc.id = lml.category_id
    where lc.household_id = '10000000-0000-4000-8000-000000000101'
      and lc.system_key = 'travel'
      and lm.month = 10
      and lml.amount_cents is null
  ),
  'Travel repair restores a nullable unbudgeted month limit'
);

select is(
  (
    select count(*)::integer
    from public.ledger_month_limits lml
    join public.ledger_categories lc on lc.id = lml.category_id
    where lc.household_id = '10000000-0000-4000-8000-000000000101'
      and lc.system_key = 'travel'
      and lml.limit_entity_id = '30000000-0000-4000-8000-000000000118'
  ),
  12,
  'Travel repair preserves the established limit identity'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000125',
        '10000000-0000-4000-8000-000000000101',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000115',
        null,
        '{"name":"Transfer source","kind":"cash","currency":"CAD","balanceCents":100,"sortOrder":4}',
        25
      )
    )->>'status'
  ),
  'applied',
  'the transfer-warning source Asset can be created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000126',
        '10000000-0000-4000-8000-000000000101',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000116',
        null,
        '{"name":"Transfer destination","kind":"cash","currency":"CAD","balanceCents":0,"sortOrder":5}',
        26
      )
    )->>'status'
  ),
  'applied',
  'the transfer-warning destination Asset can be created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000135',
        '10000000-0000-4000-8000-000000000101',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000119',
        null,
        '{"name":"Transfer replacement destination","kind":"cash","currency":"CAD","balanceCents":0,"sortOrder":6}',
        35
      )
    )->>'status'
  ),
  'applied',
  'the transfer-warning replacement destination Asset can be created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000127',
        '10000000-0000-4000-8000-000000000101',
        'ledger.transfer.upsert',
        'ledger_transfer',
        '30000000-0000-4000-8000-000000000117',
        null,
        jsonb_build_object(
          'fromAssetId', '30000000-0000-4000-8000-000000000115',
          'toAssetId', '30000000-0000-4000-8000-000000000116',
          'amountCents', 100,
          'occurredAt', '2026-09-01T16:00:00.000Z',
          'note', null
        ),
        27
      )
    )->>'status'
  ),
  'applied',
  'the warning fixture transfers value to its destination'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000128',
        '10000000-0000-4000-8000-000000000101',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000116',
        1,
        '{"name":"Transfer destination","kind":"cash","currency":"CAD","balanceCents":0,"sortOrder":5}',
        28
      )
    )->>'status'
  ),
  'applied',
  'the destination can spend its transferred value before reversal'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000136',
        '10000000-0000-4000-8000-000000000101',
        'ledger.transfer.upsert',
        'ledger_transfer',
        '30000000-0000-4000-8000-000000000117',
        1,
        jsonb_build_object(
          'fromAssetId', '30000000-0000-4000-8000-000000000115',
          'toAssetId', '30000000-0000-4000-8000-000000000119',
          'amountCents', 100,
          'occurredAt', '2026-09-02T16:00:00.000Z',
          'note', null
        ),
        36
      )
    )->'warning'->>'code'
  ),
  'negative_asset_balance',
  'transfer editing reports a negative-balance warning'
);

select is(
  (
    select result->'warning'->>'assetId'
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000136'
  ),
  '30000000-0000-4000-8000-000000000116',
  'transfer editing warns for the previous destination Asset'
);

select is(
  (
    select result->'warning'->>'balanceCents'
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000136'
  ),
  '-100',
  'transfer editing reports the previous destination final balance'
);

select is(
  (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-000000000115'
  ),
  0::bigint,
  'transfer editing leaves the source at its final balance'
);

select is(
  (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-000000000116'
  ),
  (-100)::bigint,
  'transfer editing leaves the previous destination negative'
);

select is(
  (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-000000000119'
  ),
  100::bigint,
  'transfer editing credits the replacement destination'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000137',
        '10000000-0000-4000-8000-000000000101',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000119',
        1,
        '{"name":"Transfer replacement destination","kind":"cash","currency":"CAD","balanceCents":0,"sortOrder":6}',
        37
      )
    )->>'status'
  ),
  'applied',
  'the replacement destination can spend transferred value before deletion'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000129',
        '10000000-0000-4000-8000-000000000101',
        'ledger.transfer.delete',
        'ledger_transfer',
        '30000000-0000-4000-8000-000000000117',
        2,
        '{}',
        29
      )
    )->'warning'->>'code'
  ),
  'negative_asset_balance',
  'transfer deletion reports a negative-balance warning'
);

select is(
  (
    select result->'warning'->>'assetId'
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000129'
  ),
  '30000000-0000-4000-8000-000000000119',
  'transfer deletion warns for its current destination Asset'
);

select is(
  (
    select result->'warning'->>'balanceCents'
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000129'
  ),
  '-100',
  'transfer deletion reports the exact resulting balance'
);

select is(
  (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-000000000119'
  ),
  (-100)::bigint,
  'the transfer deletion leaves its current destination negative'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000144',
        '10000000-0000-4000-8000-000000000101',
        'ledger.category.delete',
        'ledger_category',
        '30000000-0000-4000-8000-000000000102',
        3,
        '{"fromMonth":1}',
        44
      )
    )->>'status'
  ),
  'applied',
  'full category deletion removes the remaining category configuration'
);

select ok(
  (
    select
      revision = 4
      and deleted
      and winner_type = 'ledger.category.delete'
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_limit'
      and entity_id = '30000000-0000-4000-8000-000000000103'
  ),
  'full category deletion closes the established limit revision stream'
);

select ok(
  exists (
    select 1
    from public.household_tombstones
    where household_id = '10000000-0000-4000-8000-000000000101'
      and entity_type = 'ledger_limit'
      and entity_id = '30000000-0000-4000-8000-000000000103'
      and revision = 4
      and operation_id = '40000000-0000-4000-8000-000000000144'
  ),
  'full category deletion leaves a durable limit tombstone'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000145',
        '10000000-0000-4000-8000-000000000101',
        'ledger.limit.upsert',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000103',
        3,
        jsonb_build_object(
          'categoryId', '30000000-0000-4000-8000-000000000102',
          'fromMonth', 1,
          'amountCents', 1
        ),
        45
      )
    )->>'status'
  ),
  'conflict',
  'a queued limit write conflicts with the winning full category deletion'
);

select * from finish();
rollback;
