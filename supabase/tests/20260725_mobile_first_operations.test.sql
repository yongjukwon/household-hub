begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
set local timezone = 'UTC';

select no_plan();

-- Fixed identities make tenant and revision assertions independent of seed data.
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
    '00000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'mobile-a@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'mobile-b@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'mobile-outsider@example.test',
    '',
    now(),
    now(),
    now()
  );

insert into public.households (id, name, owner_user_id)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Mobile operations household A',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Mobile operations household B',
    '00000000-0000-4000-8000-000000000003'
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
    '11000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Member A',
    'owner'
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'Member B',
    'member'
  ),
  (
    '11000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    'Other household member',
    'owner'
  );

insert into public.notifications (
  id,
  household_id,
  recipient_user_id,
  actor_user_id,
  kind,
  entity_type,
  entity_id,
  payload
)
values (
  '30000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'partner_activity',
  'calendar_event',
  '30000000-0000-4000-8000-00000000000f',
  '{"action":"created"}'
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
    'enqueuedAt', '2026-07-24T20:00:00.000Z',
    'payload', payload
  );
$$;

select has_function(
  'public',
  'apply_household_operation',
  array['jsonb'],
  'the authoritative household operation RPC exists'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_household_operation'
      and pg_get_function_identity_arguments(p.oid) = 'command jsonb'
  ),
  'the operation RPC is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.apply_household_operation(jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.apply_household_operation(jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'public',
    'public.apply_household_operation(jsonb)',
    'EXECUTE'
  ),
  'only authenticated API clients receive RPC execution privilege'
);

select is(
  (
    select count(*)::integer
    from unnest(array[
      'profiles',
      'household_invites',
      'ledger_assets',
      'asset_postings',
      'ledger_transfers',
      'ledger_transfer_schedules',
      'ledger_years',
      'ledger_months',
      'ledger_categories',
      'ledger_month_categories',
      'ledger_month_limits',
      'ledger_transactions',
      'household_notes',
      'household_grocery_lists',
      'household_grocery_items',
      'household_grocery_price_history',
      'calendar_event_reminders',
      'notifications',
      'household_trips',
      'trip_expenses',
      'operation_receipts',
      'household_entity_revisions',
      'household_tombstones',
      'household_change_log'
    ]) as required_table(table_name)
    join pg_class c on c.relname = required_table.table_name
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
  ),
  24,
  'every new household table has RLS enabled'
);

select is(
  (
    select count(*)::integer
    from unnest(array[
      'profiles',
      'household_invites',
      'ledger_assets',
      'asset_postings',
      'ledger_transfers',
      'ledger_transfer_schedules',
      'ledger_years',
      'ledger_months',
      'ledger_categories',
      'ledger_month_categories',
      'ledger_month_limits',
      'ledger_transactions',
      'household_notes',
      'household_grocery_lists',
      'household_grocery_items',
      'household_grocery_price_history',
      'calendar_event_reminders',
      'notifications',
      'household_trips',
      'trip_expenses',
      'operation_receipts',
      'household_entity_revisions',
      'household_tombstones',
      'household_change_log',
      'calendar_events'
    ]) as mutable_table(table_name)
    where has_table_privilege('authenticated', 'public.' || table_name, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || table_name, 'DELETE')
       or has_table_privilege('authenticated', 'public.' || table_name, 'TRUNCATE')
  ),
  0,
  'authenticated clients have no direct write or truncate grant'
);

select is(
  (
    select count(*)::integer
    from unnest(array['households', 'household_members'])
      as tenant_table(table_name)
    where has_table_privilege(
      'authenticated',
      'public.' || table_name,
      'TRUNCATE'
    )
  ),
  0,
  'authenticated clients cannot truncate the extended tenancy tables'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

select lives_ok(
  $$
    insert into public.calendar_events (
      id,
      household_id,
      created_by,
      title,
      all_day,
      start_at,
      end_at,
      event_timezone
    )
    values (
      '31000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      'Existing zero-duration event',
      false,
      '2026-07-24T20:00:00.000Z',
      '2026-07-24T20:00:00.000Z',
      'UTC'
    )
  $$,
  'the mobile Calendar migration preserves valid legacy zero-duration events'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$
    insert into public.ledger_assets (
      id,
      household_id,
      name,
      kind,
      currency_code,
      created_by
    )
    values (
      '30000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000001',
      'Bypass',
      'cash',
      'CAD',
      '00000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'permission denied for table ledger_assets',
  'an authenticated household member cannot bypass the RPC'
);

select throws_ok(
  $$
    update public.calendar_events
    set title = 'Bypass'
    where false
  $$,
  '42501',
  'permission denied for table calendar_events',
  'the extended legacy Calendar table is no longer directly writable'
);

select throws_ok(
  $$
    truncate table public.household_notes
  $$,
  '42501',
  'permission denied for table household_notes',
  'an authenticated client cannot bypass RLS with TRUNCATE'
);

select throws_ok(
  $$
    truncate table public.household_members
  $$,
  '42501',
  'permission denied for table household_members',
  'an authenticated client cannot truncate the household authorization roster'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);

select throws_ok(
  $$
    select public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.upsert',
        'ledger_year',
        '30000000-0000-4000-8000-000000000001',
        null,
        '{"year":2026}'
      )
    )
  $$,
  '42501',
  'caller is not a member of the household',
  'the RPC rejects a caller from another household'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.upsert',
        'ledger_year',
        '30000000-0000-4000-8000-000000000001',
        null,
        '{"year":2026}'
      ) || '{"schemaVersion":2}'::jsonb
    )->>'code'
  ),
  'unsupported_schema_version',
  'the RPC rejects unsupported command schema versions'
);

select throws_ok(
  $$
    select public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.upsert',
        'ledger_year',
        '30000000-0000-4000-8000-000000000001',
        null,
        '{"year":2026}'
      ) || '{"operationId":"not-a-uuid"}'::jsonb
    )
  $$,
  '22023',
  'operationId must be a UUID',
  'the RPC validates UUID metadata before casting'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000004',
        '10000000-0000-4000-8000-000000000001',
        'unknown.write',
        'ledger_year',
        '30000000-0000-4000-8000-000000000001',
        null,
        '{}'
      )
    )->>'code'
  ),
  'unsupported_operation',
  'the RPC enforces the command allowlist'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000005',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.upsert',
        'trip',
        '30000000-0000-4000-8000-000000000001',
        null,
        '{"year":2026}'
      )
    )->>'code'
  ),
  'entity_type_mismatch',
  'the RPC rejects type/entity mismatches'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000006',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.upsert',
        'ledger_year',
        '30000000-0000-4000-8000-000000000001',
        null,
        '{"year":2026,"actorUserId":"00000000-0000-4000-8000-000000000002"}'
      )
    )->>'code'
  ),
  'invalid_payload',
  'payloads reject attempted server-owned fields'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000010',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.upsert',
        'ledger_year',
        '30000000-0000-4000-8000-000000000001',
        null,
        '{"year":2026}',
        10
      )
    )->>'status'
  ),
  'applied',
  'creating a Ledger year returns applied'
);

select is(
  (
    select count(*)::integer
    from public.ledger_months
    where year_id = '30000000-0000-4000-8000-000000000001'
  ),
  12,
  'creating a Ledger year materializes all twelve months'
);

select is(
  (
    select count(*)::integer
    from public.ledger_categories
    where year_id = '30000000-0000-4000-8000-000000000001'
      and kind = 'income'
      and system_key = any(array[
        'salary', 'bonus', 'rrsp', 'tfsa', 'espp', 'government_benefit'
      ])
  ),
  6,
  'a new Ledger year creates the six default income categories'
);

select is(
  (
    select count(*)::integer
    from public.ledger_month_categories lmc
    join public.ledger_categories lc on lc.id = lmc.category_id
    join public.ledger_months lm on lm.id = lmc.month_id
    where lm.year_id = '30000000-0000-4000-8000-000000000001'
      and lc.system_key is not null
  ),
  72,
  'each default income category is represented in all twelve months'
);

select is(
  (
    select count(*)::integer
    from public.household_entity_revisions her
    join public.ledger_categories lc
      on lc.household_id = her.household_id
      and lc.id = her.entity_id
    where lc.year_id = '30000000-0000-4000-8000-000000000001'
      and her.entity_type = 'ledger_category'
      and not her.deleted
  ),
  6,
  'default income categories receive mutable entity revisions'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000010',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.upsert',
        'ledger_year',
        '30000000-0000-4000-8000-000000000001',
        null,
        '{"year":2026}',
        10
      )
    )->>'status'
  ),
  'duplicate',
  'replaying an applied operation returns duplicate'
);

select is(
  (
    select count(*)::integer
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000010'
  ),
  1,
  'an operation ID records exactly one receipt'
);

select is(
  (
    select count(*)::integer
    from public.household_change_log
    where operation_id = '40000000-0000-4000-8000-000000000010'
  ),
  1,
  'an applied operation records exactly one change'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000010',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.upsert',
        'ledger_year',
        '30000000-0000-4000-8000-000000000001',
        null,
        '{"year":2027}',
        10
      )
    )->>'code'
  ),
  'operation_id_reused',
  'an operation ID cannot hide a different command'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000011',
        '10000000-0000-4000-8000-000000000001',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000002',
        null,
        jsonb_build_object(
          'name', 'Chequing',
          'kind', 'cash',
          'currency', 'CAD',
          'balanceCents', 1000,
          'sortOrder', 0
        ),
        11
      )
    )->>'status'
  ),
  'applied',
  'an Asset can be created through the RPC'
);

select is(
  (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-000000000002'
  ),
  1000::bigint,
  'an Asset opening balance is derived from its posting'
);

select is(
  (
    select server_sequence
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000011'
  ),
  2::bigint,
  'applied operations receive a serialized household sequence'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000012',
        '10000000-0000-4000-8000-000000000002',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000012',
        null,
        '{"name":"Other Cash","kind":"cash","currency":"CAD","balanceCents":50,"sortOrder":0}',
        1
      )
    )->>'serverSequence'
  ),
  '1',
  'server sequences are scoped per household'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

select is(
  (
    select count(*)::integer
    from public.ledger_assets
    where household_id = '10000000-0000-4000-8000-000000000002'
  ),
  0,
  'RLS hides another household after its RPC write'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000013',
        '10000000-0000-4000-8000-000000000001',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-000000000006',
        null,
        '{"name":"Wallet","kind":"cash","currency":"CAD","balanceCents":500,"sortOrder":1}',
        12
      )
    )->>'status'
  ),
  'applied',
  'a second CAD Asset can be created for transfer testing'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000014',
        '10000000-0000-4000-8000-000000000001',
        'ledger.category.upsert',
        'ledger_category',
        '30000000-0000-4000-8000-000000000003',
        null,
        jsonb_build_object(
          'yearId', '30000000-0000-4000-8000-000000000001',
          'fromMonth', 3,
          'name', 'Dining',
          'kind', 'spending',
          'sortOrder', 0
        ),
        13
      )
    )->>'status'
  ),
  'applied',
  'a category can be added from a selected month'
);

select is(
  (
    select array_agg(lm.month order by lm.month)
    from public.ledger_month_categories lmc
    join public.ledger_months lm on lm.id = lmc.month_id
    where lmc.category_id = '30000000-0000-4000-8000-000000000003'
  ),
  array[3,4,5,6,7,8,9,10,11,12]::smallint[],
  'category addition propagates from March through December only'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000015',
        '10000000-0000-4000-8000-000000000001',
        'ledger.limit.upsert',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000004',
        null,
        jsonb_build_object(
          'categoryId', '30000000-0000-4000-8000-000000000003',
          'fromMonth', 3,
          'amountCents', 50000
        ),
        14
      )
    )->>'status'
  ),
  'applied',
  'a spending limit can be propagated'
);

select is(
  (
    select count(*)::integer
    from public.ledger_month_limits lml
    join public.ledger_months lm on lm.id = lml.month_id
    where lml.category_id = '30000000-0000-4000-8000-000000000003'
      and lm.month between 3 and 12
      and lml.amount_cents = 50000
  ),
  10,
  'the selected limit is present through December'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000016',
        '10000000-0000-4000-8000-000000000001',
        'ledger.limit.upsert',
        'ledger_limit',
        '30000000-0000-4000-8000-000000000004',
        1,
        jsonb_build_object(
          'categoryId', '30000000-0000-4000-8000-000000000003',
          'fromMonth', 6,
          'amountCents', 60000
        ),
        15
      )
    )->>'status'
  ),
  'applied',
  'a later limit change applies at the current revision'
);

select is(
  (
    select array_agg(lml.amount_cents order by lm.month)
    from public.ledger_month_limits lml
    join public.ledger_months lm on lm.id = lml.month_id
    where lml.category_id = '30000000-0000-4000-8000-000000000003'
      and lm.month between 3 and 7
  ),
  array[50000,50000,50000,60000,60000]::bigint[],
  'limit changes do not alter earlier months'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000017',
        '10000000-0000-4000-8000-000000000001',
        'ledger.transaction.upsert',
        'ledger_transaction',
        '30000000-0000-4000-8000-000000000005',
        null,
        jsonb_build_object(
          'yearId', '30000000-0000-4000-8000-000000000001',
          'month', 4,
          'categoryId', '30000000-0000-4000-8000-000000000003',
          'assetId', '30000000-0000-4000-8000-000000000002',
          'kind', 'spending',
          'amountCents', 1500,
          'occurredAt', '2026-04-10T18:30:00.000Z',
          'description', 'Dinner'
        ),
        16
      )
    )->'warning'->>'code'
  ),
  'negative_asset_balance',
  'overspending applies and returns a negative-balance warning'
);

select is(
  (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-000000000002'
  ),
  (-500)::bigint,
  'a spending transaction debits its Asset atomically'
);

select is(
  (
    select sum(amount_cents)::bigint
    from public.asset_postings
    where effect_type = 'ledger_transaction'
      and effect_id = '30000000-0000-4000-8000-000000000005'
  ),
  (-1500)::bigint,
  'the transaction posting matches the source balance effect'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000018',
        '10000000-0000-4000-8000-000000000001',
        'ledger.transaction.upsert',
        'ledger_transaction',
        '30000000-0000-4000-8000-000000000005',
        1,
        jsonb_build_object(
          'yearId', '30000000-0000-4000-8000-000000000001',
          'month', 4,
          'categoryId', '30000000-0000-4000-8000-000000000003',
          'assetId', '30000000-0000-4000-8000-000000000002',
          'kind', 'spending',
          'amountCents', 1200,
          'occurredAt', '2026-04-10T18:30:00.000Z',
          'description', 'Dinner corrected'
        ),
        17
      )
    )->>'status'
  ),
  'applied',
  'editing a transaction reverses and reapplies at the current revision'
);

select is(
  (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-000000000002'
  ),
  (-200)::bigint,
  'the edited transaction leaves the exact net Asset effect'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000019',
        '10000000-0000-4000-8000-000000000001',
        'ledger.transaction.upsert',
        'ledger_transaction',
        '30000000-0000-4000-8000-000000000005',
        1,
        jsonb_build_object(
          'yearId', '30000000-0000-4000-8000-000000000001',
          'month', 4,
          'categoryId', '30000000-0000-4000-8000-000000000003',
          'assetId', '30000000-0000-4000-8000-000000000002',
          'kind', 'spending',
          'amountCents', 900,
          'occurredAt', '2026-04-10T18:30:00.000Z',
          'description', 'Stale edit'
        ),
        18
      )
    )->>'status'
  ),
  'conflict',
  'a stale mutation returns a conflict instead of applying'
);

select is(
  (
    select (result->>'currentRevision')::bigint
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000019'
  ),
  2::bigint,
  'a conflict reports the current entity revision'
);

select is(
  (
    select result->'winner'->>'operationId'
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000019'
  ),
  '40000000-0000-4000-8000-000000000018',
  'a conflict identifies the winning operation'
);

select is(
  (
    select amount_cents
    from public.ledger_transactions
    where id = '30000000-0000-4000-8000-000000000005'
  ),
  1200::bigint,
  'a conflict leaves the transaction unchanged'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000020',
        '10000000-0000-4000-8000-000000000001',
        'ledger.category.delete',
        'ledger_category',
        '30000000-0000-4000-8000-000000000003',
        1,
        '{"fromMonth":3}',
        19
      )
    )->>'code'
  ),
  'category_has_spending',
  'category removal is blocked by selected-or-later spending'
);

select is(
  (
    select result->'details'->'blockingMonths'
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000020'
  ),
  '["04"]'::jsonb,
  'a rejected category removal identifies every blocking month'
);

select is(
  (
    select count(*)::integer
    from public.ledger_month_categories
    where category_id = '30000000-0000-4000-8000-000000000003'
  ),
  10,
  'a blocked category removal makes no partial change'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000021',
        '10000000-0000-4000-8000-000000000001',
        'ledger.transfer.upsert',
        'ledger_transfer',
        '30000000-0000-4000-8000-000000000007',
        null,
        jsonb_build_object(
          'fromAssetId', '30000000-0000-4000-8000-000000000002',
          'toAssetId', '30000000-0000-4000-8000-000000000006',
          'amountCents', 100,
          'occurredAt', '2026-04-11T18:30:00.000Z',
          'note', 'Cash move'
        ),
        20
      )
    )->>'status'
  ),
  'applied',
  'a same-currency Asset transfer applies'
);

select is(
  (
    select sum(amount_cents)::bigint
    from public.asset_postings
    where effect_type = 'ledger_transfer'
      and effect_id = '30000000-0000-4000-8000-000000000007'
  ),
  0::bigint,
  'a transfer posting group balances to zero'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000022',
        '10000000-0000-4000-8000-000000000001',
        'ledger.schedule.upsert',
        'ledger_schedule',
        '30000000-0000-4000-8000-000000000008',
        null,
        jsonb_build_object(
          'fromAssetId', '30000000-0000-4000-8000-000000000002',
          'toAssetId', '30000000-0000-4000-8000-000000000006',
          'amountCents', 50,
          'frequency', 'monthly',
          'startsAt', '2026-05-01T16:00:00.000Z',
          'timezone', 'America/Vancouver',
          'active', true
        ),
        21
      )
    )->>'status'
  ),
  'applied',
  'a recurring Asset transfer schedule validates timezone and cadence'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000023',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.clear',
        'ledger_year',
        '30000000-0000-4000-8000-000000000001',
        1,
        '{"year":2026,"confirmation":"2025"}',
        22
      )
    )->>'code'
  ),
  'typed_year_mismatch',
  'clearing a populated year requires the exact typed year'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000024',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.upsert',
        'ledger_year',
        '30000000-0000-4000-8000-000000000011',
        null,
        '{"year":2027}',
        23
      )
    )->>'status'
  ),
  'applied',
  'a second Ledger year can coexist'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000025',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.clear',
        'ledger_year',
        '30000000-0000-4000-8000-000000000001',
        1,
        '{"year":2026,"confirmation":"2026"}',
        24
      )
    )->>'status'
  ),
  'applied',
  'the correctly confirmed year clear applies'
);

select ok(
  not exists (
    select 1
    from public.ledger_years
    where id = '30000000-0000-4000-8000-000000000001'
  )
  and exists (
    select 1
    from public.ledger_years
    where id = '30000000-0000-4000-8000-000000000011'
  ),
  'year clear deletes only the typed target year'
);

select is(
  (
    select count(*)::integer
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000001'
      and deleted
      and (entity_type, entity_id) in (
        ('ledger_category', '30000000-0000-4000-8000-000000000003'::uuid),
        ('ledger_limit', '30000000-0000-4000-8000-000000000004'::uuid),
        ('ledger_transaction', '30000000-0000-4000-8000-000000000005'::uuid)
      )
  ),
  3,
  'year clear marks every operation-addressable child revision deleted'
);

select is(
  (
    select count(*)::integer
    from public.household_tombstones
    where household_id = '10000000-0000-4000-8000-000000000001'
      and operation_id = '40000000-0000-4000-8000-000000000025'
      and (entity_type, entity_id) in (
        ('ledger_category', '30000000-0000-4000-8000-000000000003'::uuid),
        ('ledger_limit', '30000000-0000-4000-8000-000000000004'::uuid),
        ('ledger_transaction', '30000000-0000-4000-8000-000000000005'::uuid)
      )
  ),
  3,
  'year clear leaves durable tombstones for its logical children'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000039',
        '10000000-0000-4000-8000-000000000001',
        'ledger.transaction.upsert',
        'ledger_transaction',
        '30000000-0000-4000-8000-000000000005',
        2,
        jsonb_build_object(
          'yearId', '30000000-0000-4000-8000-000000000001',
          'month', 4,
          'categoryId', '30000000-0000-4000-8000-000000000003',
          'assetId', '30000000-0000-4000-8000-000000000002',
          'kind', 'spending',
          'amountCents', 1200,
          'occurredAt', '2026-04-10T18:30:00.000Z',
          'description', 'Queued before clear'
        ),
        38
      )
    )->>'status'
  ),
  'conflict',
  'a queued child mutation conflicts with the winning year clear'
);

select is(
  (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-000000000002'
  ),
  900::bigint,
  'year clear reverses that year transaction but leaves Asset transfers intact'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000026',
        '10000000-0000-4000-8000-000000000001',
        'trip.upsert',
        'trip',
        '30000000-0000-4000-8000-000000000009',
        null,
        jsonb_build_object(
          'name', 'London',
          'destination', 'London, UK',
          'timezone', 'Europe/London',
          'startDate', '2026-08-01',
          'endDate', '2026-08-10',
          'destinationCurrency', 'GBP'
        ),
        25
      )
    )->>'status'
  ),
  'applied',
  'a standalone Trip stores its destination timezone and currency'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000027',
        '10000000-0000-4000-8000-000000000001',
        'trip.expense.upsert',
        'trip_expense',
        '30000000-0000-4000-8000-00000000000a',
        null,
        jsonb_build_object(
          'tripId', '30000000-0000-4000-8000-000000000009',
          'assetId', '30000000-0000-4000-8000-000000000002',
          'amountCents', 200,
          'currency', 'CAD',
          'spentAt', '2026-08-03T12:00:00.000Z',
          'description', 'Airport train'
        ),
        26
      )
    )->>'status'
  ),
  'applied',
  'a CAD Trip expense applies'
);

select ok(
  exists (
    select 1
    from public.ledger_transactions lt
    join public.ledger_categories lc on lc.id = lt.category_id
    join public.ledger_years ly on ly.id = lt.year_id
    where lt.trip_expense_id = '30000000-0000-4000-8000-00000000000a'
      and lt.amount_cents = 200
      and lc.system_key = 'travel'
      and ly.year = 2026
  ),
  'a CAD Trip expense creates a linked unbudgeted Travel Ledger row'
);

select is(
  (
    select count(*)::integer
    from public.ledger_months lm
    join public.ledger_years ly on ly.id = lm.year_id
    where ly.household_id = '10000000-0000-4000-8000-000000000001'
      and ly.year = 2026
  ),
  12,
  'the CAD Trip path recreates a missing Statement with twelve months'
);

select is(
  (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-000000000002'
  ),
  700::bigint,
  'the CAD Trip expense debits its Asset exactly once'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000028',
        '10000000-0000-4000-8000-000000000001',
        'ledger.asset.upsert',
        'ledger_asset',
        '30000000-0000-4000-8000-00000000000b',
        null,
        '{"name":"GBP Cash","kind":"cash","currency":"GBP","balanceCents":500,"sortOrder":2}',
        27
      )
    )->>'status'
  ),
  'applied',
  'a foreign-currency cash Asset can be created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000029',
        '10000000-0000-4000-8000-000000000001',
        'trip.expense.upsert',
        'trip_expense',
        '30000000-0000-4000-8000-00000000000c',
        null,
        jsonb_build_object(
          'tripId', '30000000-0000-4000-8000-000000000009',
          'assetId', '30000000-0000-4000-8000-00000000000b',
          'amountCents', 700,
          'currency', 'GBP',
          'spentAt', '2026-08-04T12:00:00.000Z',
          'description', 'Museum'
        ),
        28
      )
    )->'warning'->>'balanceCents'
  ),
  '-200',
  'a foreign expense may make its matching Asset negative'
);

select is(
  (
    select count(*)::integer
    from public.ledger_transactions
    where trip_expense_id = '30000000-0000-4000-8000-00000000000c'
  ),
  0,
  'a foreign Trip expense creates no CAD Ledger row'
);

select is(
  (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-00000000000b'
  ),
  (-200)::bigint,
  'a foreign Trip expense debits only its matching foreign Asset'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000030',
        '10000000-0000-4000-8000-000000000001',
        'trip.expense.upsert',
        'trip_expense',
        '30000000-0000-4000-8000-00000000000d',
        null,
        jsonb_build_object(
          'tripId', '30000000-0000-4000-8000-000000000009',
          'assetId', '30000000-0000-4000-8000-00000000000b',
          'amountCents', 100,
          'currency', 'CAD',
          'spentAt', '2026-08-05T12:00:00.000Z',
          'description', 'Wrong currency'
        ),
        29
      )
    )->>'code'
  ),
  'currency_mismatch',
  'Trip expense currency mismatch rejects the whole operation'
);

select ok(
  not exists (
    select 1
    from public.trip_expenses
    where id = '30000000-0000-4000-8000-00000000000d'
  )
  and (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-00000000000b'
  ) = -200,
  'a rejected Trip expense leaves both row and Asset balance unchanged'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000031',
        '10000000-0000-4000-8000-000000000001',
        'grocery.list.upsert',
        'grocery_list',
        '30000000-0000-4000-8000-00000000000e',
        null,
        '{"name":"Market","sortOrder":0}',
        30
      )
    )->>'status'
  ),
  'applied',
  'a standalone Grocery list can be created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000032',
        '10000000-0000-4000-8000-000000000001',
        'grocery.item.upsert',
        'grocery_item',
        '30000000-0000-4000-8000-00000000000f',
        null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-00000000000e',
          'name', 'Milk',
          'quantity', '2',
          'checked', false,
          'unitPriceCents', 499,
          'sortOrder', 0
        ),
        31
      )
    )->>'status'
  ),
  'applied',
  'a Grocery item mutation applies'
);

select is(
  (
    select count(*)::integer
    from public.household_grocery_price_history
    where list_id = '30000000-0000-4000-8000-00000000000e'
      and item_name_normalized = 'milk'
      and price_cents = 499
  ),
  1,
  'a Grocery price is appended to immutable CAD history'
);

select is(
  (
    select checked_at
    from public.household_grocery_items
    where id = '30000000-0000-4000-8000-00000000000f'
  ),
  null::timestamptz,
  'a new unchecked Grocery item has no purchase timestamp'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000050',
        '10000000-0000-4000-8000-000000000001',
        'grocery.item.upsert',
        'grocery_item',
        '30000000-0000-4000-8000-00000000000f',
        1,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-00000000000e',
          'name', 'Milk',
          'quantity', '2',
          'checked', true,
          'unitPriceCents', 499,
          'sortOrder', 0
        ),
        50
      )
    )->>'status'
  ),
  'applied',
  'checking a Grocery item applies'
);

create temporary table grocery_check_times (
  first_checked_at timestamptz not null
) on commit drop;

insert into grocery_check_times (first_checked_at)
select checked_at
from public.household_grocery_items
where id = '30000000-0000-4000-8000-00000000000f';

select ok(
  (select first_checked_at is not null from grocery_check_times),
  'checking an item assigns its purchase timestamp'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000051',
        '10000000-0000-4000-8000-000000000001',
        'grocery.item.upsert',
        'grocery_item',
        '30000000-0000-4000-8000-00000000000f',
        2,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-00000000000e',
          'name', 'Whole milk',
          'quantity', '1',
          'checked', true,
          'unitPriceCents', 529,
          'sortOrder', 0
        ),
        51
      )
    )->>'status'
  ),
  'applied',
  'editing a checked Grocery item applies'
);

select is(
  (
    select checked_at
    from public.household_grocery_items
    where id = '30000000-0000-4000-8000-00000000000f'
  ),
  (select first_checked_at from grocery_check_times),
  'editing a checked item preserves its purchase timestamp'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000052',
        '10000000-0000-4000-8000-000000000001',
        'grocery.item.upsert',
        'grocery_item',
        '30000000-0000-4000-8000-00000000000f',
        3,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-00000000000e',
          'name', 'Whole milk',
          'quantity', '1',
          'checked', false,
          'unitPriceCents', 529,
          'sortOrder', 0
        ),
        52
      )
    )->>'status'
  ),
  'applied',
  'unchecking a Grocery item applies'
);

select is(
  (
    select checked_at
    from public.household_grocery_items
    where id = '30000000-0000-4000-8000-00000000000f'
  ),
  null::timestamptz,
  'unchecking an item clears its purchase timestamp'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000053',
        '10000000-0000-4000-8000-000000000001',
        'grocery.item.upsert',
        'grocery_item',
        '30000000-0000-4000-8000-00000000000f',
        4,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-00000000000e',
          'name', 'Whole milk',
          'quantity', '1',
          'checked', true,
          'unitPriceCents', 529,
          'sortOrder', 0
        ),
        53
      )
    )->>'status'
  ),
  'applied',
  'rechecking a Grocery item applies'
);

select ok(
  (
    select checked_at > (select first_checked_at from grocery_check_times)
    from public.household_grocery_items
    where id = '30000000-0000-4000-8000-00000000000f'
  ),
  'rechecking assigns a newer purchase timestamp'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000033',
        '10000000-0000-4000-8000-000000000001',
        'note.upsert',
        'note',
        '31000000-0000-4000-8000-000000000001',
        null,
        jsonb_build_object(
          'title', 'Packing',
          'document', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Passport"}]}]}'::jsonb
        ),
        32
      )
    )->>'status'
  ),
  'applied',
  'a Note accepts the shared restricted rich-text JSON'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000034',
        '10000000-0000-4000-8000-000000000001',
        'note.upsert',
        'note',
        '31000000-0000-4000-8000-000000000002',
        null,
        jsonb_build_object(
          'title', 'Unsafe',
          'document', '{"type":"doc","content":[{"type":"image","attrs":{"src":"https://example.test/x"}}]}'::jsonb
        ),
        33
      )
    )->>'code'
  ),
  'invalid_payload',
  'the SQL payload contract rejects unsupported Note nodes'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000035',
        '10000000-0000-4000-8000-000000000001',
        'calendar.event.upsert',
        'calendar_event',
        '31000000-0000-4000-8000-000000000003',
        null,
        jsonb_build_object(
          'title', 'Dinner',
          'note', 'Reservation',
          'ownerId', null,
          'allDay', false,
          'startAt', '2026-08-05T01:00:00.000Z',
          'endAt', '2026-08-05T03:00:00.000Z',
          'timezone', 'America/Vancouver',
          'recurrenceFrequency', 'none',
          'recurrenceUntil', null,
          'reminders', jsonb_build_array('10m', '1h')
        ),
        34
      )
    )->>'status'
  ),
  'applied',
  'a timed Calendar event stores UTC instants and its IANA timezone'
);

select is(
  (
    select array_agg(preset order by preset)
    from public.calendar_event_reminders
    where event_id = '31000000-0000-4000-8000-000000000003'
  ),
  array['10m','1h']::text[],
  'Calendar reminders are replaced atomically with the event'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000040',
        '10000000-0000-4000-8000-000000000001',
        'calendar.event.upsert',
        'calendar_event',
        '31000000-0000-4000-8000-000000000004',
        null,
        jsonb_build_object(
          'title', 'Duplicate reminder',
          'note', null,
          'ownerId', null,
          'allDay', false,
          'startAt', '2026-08-06T01:00:00.000Z',
          'endAt', '2026-08-06T03:00:00.000Z',
          'timezone', 'America/Vancouver',
          'recurrenceFrequency', 'none',
          'recurrenceUntil', null,
          'reminders', jsonb_build_array('1h', '1h')
        ),
        39
      )
    )->>'code'
  ),
  'invalid_payload',
  'duplicate Calendar reminders return a structured rejection'
);

select is(
  (
    select status
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000040'
  ),
  'rejected',
  'a duplicate-reminder rejection is durably replayable'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000036',
        '10000000-0000-4000-8000-000000000001',
        'notification.read',
        'notification',
        '30000000-0000-4000-8000-000000000010',
        1,
        '{"readAt":"2026-07-24T21:00:00.000Z"}',
        35
      )
    )->>'status'
  ),
  'applied',
  'a recipient can mark their notification read'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000037',
        '10000000-0000-4000-8000-000000000001',
        'settings.update',
        'settings',
        '00000000-0000-4000-8000-000000000001',
        null,
        '{"displayName":"Member A","appearance":"dark","notificationsEnabled":true}',
        36
      )
    )->>'status'
  ),
  'applied',
  'settings.update changes only the caller profile'
);

select is(
  (
    select appearance
    from public.profiles
    where user_id = '00000000-0000-4000-8000-000000000001'
  ),
  'dark',
  'the caller profile stores the validated appearance'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000038',
        '10000000-0000-4000-8000-000000000001',
        'ledger.year.clear',
        'ledger_year',
        (
          select id
          from public.ledger_years
          where household_id = '10000000-0000-4000-8000-000000000001'
            and year = 2026
        ),
        1,
        '{"year":2026,"confirmation":"2026"}',
        37
      )
    )->>'status'
  ),
  'applied',
  'year clear remains usable when CAD Trip expenses are linked'
);

select is(
  (
    select (result->'details'->>'detachedTripExpenseCount')::integer
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-000000000038'
  ),
  1,
  'year clear reports the linked Trip expense it detached'
);

select ok(
  (
    select ledger_transaction_id is null
    from public.trip_expenses
    where id = '30000000-0000-4000-8000-00000000000a'
  )
  and (
    select balance_cents
    from public.ledger_asset_balances
    where id = '30000000-0000-4000-8000-000000000002'
  ) = 700,
  'year clear detaches the Trip while preserving its Asset effect'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000041',
        '10000000-0000-4000-8000-000000000001',
        'trip.delete',
        'trip',
        '30000000-0000-4000-8000-000000000009',
        1,
        '{}',
        40
      )
    )->>'status'
  ),
  'applied',
  'deleting a Trip reverses its expense effects'
);

select is(
  (
    select count(*)::integer
    from public.household_entity_revisions
    where household_id = '10000000-0000-4000-8000-000000000001'
      and entity_type = 'trip_expense'
      and entity_id in (
        '30000000-0000-4000-8000-00000000000a',
        '30000000-0000-4000-8000-00000000000c'
      )
      and deleted
  ),
  2,
  'Trip deletion marks every child expense revision deleted'
);

select is(
  (
    select count(*)::integer
    from public.household_tombstones
    where household_id = '10000000-0000-4000-8000-000000000001'
      and operation_id = '40000000-0000-4000-8000-000000000041'
      and entity_type = 'trip_expense'
      and entity_id in (
        '30000000-0000-4000-8000-00000000000a',
        '30000000-0000-4000-8000-00000000000c'
      )
  ),
  2,
  'Trip deletion leaves durable tombstones for its expenses'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000042',
        '10000000-0000-4000-8000-000000000001',
        'trip.expense.upsert',
        'trip_expense',
        '30000000-0000-4000-8000-00000000000a',
        1,
        jsonb_build_object(
          'tripId', '30000000-0000-4000-8000-000000000009',
          'assetId', '30000000-0000-4000-8000-000000000002',
          'amountCents', 200,
          'currency', 'CAD',
          'spentAt', '2026-08-03T12:00:00.000Z',
          'description', 'Queued before Trip deletion'
        ),
        41
      )
    )->>'status'
  ),
  'conflict',
  'a queued expense mutation conflicts with the winning Trip deletion'
);

select is(
  (
    select count(*)::integer
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = any(array[
        'ledger_assets',
        'asset_postings',
        'ledger_transfers',
        'ledger_transfer_schedules',
        'ledger_years',
        'ledger_months',
        'ledger_categories',
        'ledger_month_categories',
        'ledger_month_limits',
        'ledger_transactions',
        'household_notes',
        'household_grocery_lists',
        'household_grocery_items',
        'household_grocery_price_history',
        'calendar_events',
        'calendar_event_reminders',
        'notifications',
        'household_trips',
        'trip_expenses',
        'household_tombstones',
        'household_change_log'
      ])
  ),
  21,
  'Realtime publishes all user-facing mobile-first change tables'
);

select * from finish();
rollback;
