begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
set local timezone = 'UTC';

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-0000000000e1',
    'authenticated', 'authenticated', 'grocery-contract-a@example.test', '',
    now(), now(), now()
  ),
  (
    '00000000-0000-4000-8000-0000000000e2',
    'authenticated', 'authenticated', 'grocery-contract-b@example.test', '',
    now(), now(), now()
  ),
  (
    '00000000-0000-4000-8000-0000000000e3',
    'authenticated', 'authenticated', 'grocery-contract-outsider@example.test', '',
    now(), now(), now()
  );

insert into public.households (id, name, owner_user_id)
values
  (
    '10000000-0000-4000-8000-0000000000e1',
    'Grocery contract household',
    '00000000-0000-4000-8000-0000000000e1'
  ),
  (
    '10000000-0000-4000-8000-0000000000e2',
    'Other grocery household',
    '00000000-0000-4000-8000-0000000000e3'
  );

insert into public.household_members (
  id, household_id, user_id, display_name, member_role
)
values
  (
    '11000000-0000-4000-8000-0000000000e1',
    '10000000-0000-4000-8000-0000000000e1',
    '00000000-0000-4000-8000-0000000000e1',
    'Grocery Owner', 'owner'
  ),
  (
    '11000000-0000-4000-8000-0000000000e2',
    '10000000-0000-4000-8000-0000000000e1',
    '00000000-0000-4000-8000-0000000000e2',
    'Grocery Member', 'member'
  ),
  (
    '11000000-0000-4000-8000-0000000000e3',
    '10000000-0000-4000-8000-0000000000e2',
    '00000000-0000-4000-8000-0000000000e3',
    'Other Owner', 'owner'
  );

insert into public.household_grocery_lists (
  id, household_id, name, sort_order, created_by
)
values
  (
    '30000000-0000-4000-8000-0000000000e1',
    '10000000-0000-4000-8000-0000000000e1',
    'Market', 0, '00000000-0000-4000-8000-0000000000e1'
  ),
  (
    '30000000-0000-4000-8000-0000000000e2',
    '10000000-0000-4000-8000-0000000000e1',
    'Warehouse', 1, '00000000-0000-4000-8000-0000000000e1'
  ),
  (
    '30000000-0000-4000-8000-0000000000ef',
    '10000000-0000-4000-8000-0000000000e2',
    'Foreign Store', 0, '00000000-0000-4000-8000-0000000000e3'
  );

create function pg_temp.operation_command(
  operation_id uuid,
  household_id uuid,
  operation_type text,
  entity_type text,
  entity_id uuid,
  base_revision bigint,
  payload jsonb,
  local_sequence bigint
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'operationId', operation_id,
    'deviceId', '20000000-0000-4000-8000-0000000000e1',
    'localSequence', local_sequence,
    'householdId', household_id,
    'type', operation_type,
    'entityType', entity_type,
    'entityId', entity_id,
    'baseRevision', base_revision,
    'enqueuedAt', '2026-08-13T12:00:00.000Z',
    'payload', payload
  );
$$;

select has_column(
  'public', 'household_grocery_items', 'purchase_quantity',
  'Grocery items store canonical purchase quantity'
);
select has_column(
  'public', 'household_grocery_items', 'total_price_cents',
  'Grocery items store canonical total price'
);
select has_column(
  'public', 'household_grocery_items', 'purchase_occurrence_id',
  'Grocery items store a purchase occurrence'
);
select has_column(
  'public', 'household_grocery_price_history', 'store_name',
  'Grocery history snapshots its store name'
);
select has_column(
  'public', 'household_grocery_price_history', 'source_item_id',
  'Grocery history retains its source item identity'
);
select has_column(
  'public', 'household_grocery_price_history', 'purchase_occurrence_id',
  'Grocery history stores occurrence identity'
);
select has_column(
  'public', 'household_grocery_price_history', 'purchase_quantity',
  'Grocery history stores exact purchase quantity'
);
select has_column(
  'public', 'household_grocery_price_history', 'total_price_cents',
  'Grocery history stores the exact total paid'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public.mobile_apply_grocery_item_upsert(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.mobile_apply_grocery_item_upsert(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated', 'public.apply_household_operation_v4(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.mobile_operation_payload_valid_v3(text,jsonb)', 'EXECUTE'
  ),
  'new Grocery helpers and wrapped functions are not client-callable'
);

select ok(
  (
    select bool_and(public.mobile_operation_payload_valid(
      'grocery.item.upsert', payload
    ))
    from (
      values
        ('{"listId":"30000000-0000-4000-8000-0000000000e1","name":"Milk","quantity":null,"checked":false,"unitPriceCents":null,"sortOrder":0,"purchaseQuantity":null,"totalPriceCents":null,"purchaseOccurrenceId":null}'::jsonb),
        ('{"listId":"30000000-0000-4000-8000-0000000000e1","name":"Milk","quantity":"2","checked":false,"unitPriceCents":250,"sortOrder":0,"purchaseQuantity":2,"totalPriceCents":500,"purchaseOccurrenceId":null}'::jsonb),
        ('{"listId":"30000000-0000-4000-8000-0000000000e1","name":"Milk","quantity":"2","checked":false,"unitPriceCents":null,"sortOrder":0,"purchaseQuantity":2,"totalPriceCents":null,"purchaseOccurrenceId":null}'::jsonb),
        ('{"listId":"30000000-0000-4000-8000-0000000000e1","name":"Milk","quantity":null,"checked":true,"unitPriceCents":null,"sortOrder":0,"purchaseQuantity":null,"totalPriceCents":null,"purchaseOccurrenceId":"60000000-0000-4000-8000-000000000001"}'::jsonb),
        ('{"listId":"30000000-0000-4000-8000-0000000000e1","name":"Milk","quantity":"2","checked":true,"unitPriceCents":250,"sortOrder":0,"purchaseQuantity":2,"totalPriceCents":500,"purchaseOccurrenceId":"60000000-0000-4000-8000-000000000001"}'::jsonb)
    ) producer_states(payload)
  ),
  'the server validator accepts every canonical Grocery producer state'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e1', true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e1',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e1', null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Invalid partial', 'quantity', '1', 'checked', false,
          'unitPriceCents', 100, 'purchaseQuantity', 1,
          'purchaseOccurrenceId', null, 'sortOrder', 0
        ),
        1
      )
    )->>'code'
  ),
  'invalid_payload',
  'a partial canonical Grocery payload is rejected'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e2',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e2', null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Invalid zero', 'quantity', '1', 'checked', false,
          'unitPriceCents', 0, 'purchaseQuantity', 0,
          'totalPriceCents', 100, 'purchaseOccurrenceId', null,
          'sortOrder', 0
        ),
        2
      )
    )->>'code'
  ),
  'invalid_payload',
  'canonical purchase quantity must be positive'
);

-- A canonical item can hold a future price while unchecked. It becomes
-- purchase history only when a server-dated checked occurrence is created.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e3',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '2', 'checked', false,
          'unitPriceCents', 250, 'purchaseQuantity', 2,
          'totalPriceCents', 500, 'purchaseOccurrenceId', null,
          'sortOrder', 0
        ),
        3
      )
    )->>'status'
  ),
  'applied',
  'an unchecked canonical priced item applies'
);

select is(
  (
    select jsonb_build_object(
      'quantity', purchase_quantity,
      'total', total_price_cents,
      'occurrence', purchase_occurrence_id
    )
    from public.household_grocery_items
    where id = '50000000-0000-4000-8000-0000000000e3'
  ),
  '{"quantity":2,"total":500,"occurrence":null}'::jsonb,
  'canonical item fields persist before purchase'
);

reset role;

select throws_ok(
  $$
    update public.household_grocery_items
    set purchase_quantity = 0
    where id = '50000000-0000-4000-8000-0000000000e3'
  $$,
  '23514',
  null,
  'the item table rejects a nonpositive canonical quantity'
);

select throws_ok(
  $$
    update public.household_grocery_items
    set purchase_quantity = null, total_price_cents = 500
    where id = '50000000-0000-4000-8000-0000000000e3'
  $$,
  '23514',
  null,
  'the item table rejects a total without purchase quantity'
);

select throws_ok(
  $$
    update public.household_grocery_items
    set checked = true, purchase_occurrence_id = null
    where id = '50000000-0000-4000-8000-0000000000e3'
  $$,
  '23514',
  null,
  'the item table keeps checked state and occurrence identity consistent'
);

set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.household_grocery_price_history
    where source_item_id = '50000000-0000-4000-8000-0000000000e3'
  ),
  0,
  'an unchecked canonical price does not create purchase history'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e4',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 1,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '2', 'checked', true,
          'unitPriceCents', 250, 'purchaseQuantity', 2,
          'totalPriceCents', 500,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000e1',
          'sortOrder', 0
        ),
        4
      )
    )->>'status'
  ),
  'applied',
  'checking a canonical priced item records its purchase'
);

create temporary table first_milk_purchase (
  checked_at timestamptz not null,
  history_id uuid not null
) on commit drop;

insert into first_milk_purchase (checked_at, history_id)
select item.checked_at, history.id
from public.household_grocery_items item
join public.household_grocery_price_history history
  on history.purchase_occurrence_id = item.purchase_occurrence_id
where item.id = '50000000-0000-4000-8000-0000000000e3';

select is(
  (
    select jsonb_build_object(
      'store', store_name,
      'source', source_item_id,
      'occurrence', purchase_occurrence_id,
      'quantity', purchase_quantity,
      'total', total_price_cents,
      'unit', price_cents,
      'actor', recorded_by,
      'dateMatches', recorded_at = (
        select checked_at from first_milk_purchase
      )
    )
    from public.household_grocery_price_history
    where purchase_occurrence_id =
      '60000000-0000-4000-8000-0000000000e1'
  ),
  jsonb_build_object(
    'store', 'Market',
    'source', '50000000-0000-4000-8000-0000000000e3'::uuid,
    'occurrence', '60000000-0000-4000-8000-0000000000e1'::uuid,
    'quantity', 2,
    'total', 500,
    'unit', 250,
    'actor', '00000000-0000-4000-8000-0000000000e1'::uuid,
    'dateMatches', true
  ),
  'purchase history stores server-owned metadata and the checked date'
);

reset role;

select throws_ok(
  $$
    update public.household_grocery_price_history
    set total_price_cents = 0
    where purchase_occurrence_id =
      '60000000-0000-4000-8000-0000000000e1'
  $$,
  '23514',
  null,
  'the history table rejects a nonpositive canonical total'
);

set local role authenticated;

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e4',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 1,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '2', 'checked', true,
          'unitPriceCents', 250, 'purchaseQuantity', 2,
          'totalPriceCents', 500,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000e1',
          'sortOrder', 0
        ),
        4
      )
    )->>'status'
  ),
  'duplicate',
  'an exact purchase-operation replay is idempotent'
);

select is(
  (
    select count(*)::integer
    from public.household_grocery_price_history
    where item_name_normalized = 'milk'
  ),
  1,
  'an operation replay does not duplicate purchase history'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e4',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 2,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '2', 'checked', true,
          'unitPriceCents', 300, 'purchaseQuantity', 2,
          'totalPriceCents', 600,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000e1',
          'sortOrder', 0
        ),
        4
      )
    )->>'code'
  ),
  'operation_id_reused',
  'an operation ID cannot hide changed canonical purchase data'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e5',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 2,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '4', 'checked', true,
          'unitPriceCents', 250, 'purchaseQuantity', 4,
          'totalPriceCents', 1000,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000e1',
          'sortOrder', 0
        ),
        5
      )
    )->>'status'
  ),
  'applied',
  'editing the same purchase occurrence applies'
);

select is(
  (
    select jsonb_build_object(
      'sameId', id = (select history_id from first_milk_purchase),
      'sameDate', recorded_at = (select checked_at from first_milk_purchase),
      'quantity', purchase_quantity,
      'total', total_price_cents
    )
    from public.household_grocery_price_history
    where purchase_occurrence_id =
      '60000000-0000-4000-8000-0000000000e1'
  ),
  '{"sameId":true,"sameDate":true,"quantity":4,"total":1000}'::jsonb,
  'same-occurrence edits update exact values without changing purchase date'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e6',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 2,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '5', 'checked', true,
          'unitPriceCents', 250, 'purchaseQuantity', 5,
          'totalPriceCents', 1250,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000e1',
          'sortOrder', 0
        ),
        6
      )
    )->>'status'
  ),
  'conflict',
  'stale concurrent purchase edits conflict before history changes'
);

select is(
  (
    select total_price_cents
    from public.household_grocery_price_history
    where purchase_occurrence_id =
      '60000000-0000-4000-8000-0000000000e1'
  ),
  1000::bigint,
  'a conflicted edit leaves purchase history unchanged'
);

-- Uncheck/recheck creates a new occurrence. An identical exact ratio in the
-- same list/store bucket advances the existing row rather than duplicating it.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e7',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 3,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '4', 'checked', false,
          'unitPriceCents', 250, 'purchaseQuantity', 4,
          'totalPriceCents', 1000, 'purchaseOccurrenceId', null,
          'sortOrder', 0
        ),
        7
      )
    )->>'status'
  ),
  'applied',
  'unchecking clears the active occurrence'
);

select pg_sleep(0.002);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e8',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 4,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '4', 'checked', true,
          'unitPriceCents', 250, 'purchaseQuantity', 4,
          'totalPriceCents', 1000,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000e2',
          'sortOrder', 0
        ),
        8
      )
    )->>'status'
  ),
  'applied',
  'rechecking creates a later purchase occurrence'
);

select is(
  (
    select jsonb_build_object(
      'count', count(*),
      'occurrence', max(purchase_occurrence_id::text),
      'dateMatches', bool_and(recorded_at = (
        select checked_at from public.household_grocery_items
        where id = '50000000-0000-4000-8000-0000000000e3'
      ))
    )
    from public.household_grocery_price_history
    where item_name_normalized = 'milk'
      and store_name = 'Market'
  ),
  '{"count":1,"occurrence":"60000000-0000-4000-8000-0000000000e2","dateMatches":true}'::jsonb,
  'same-store exact-ratio dedupe advances date and occurrence metadata'
);

-- A sub-cent ratio change must not collapse merely because compatibility
-- price_cents rounds to the same integer cent.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000e9',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 5,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '10', 'checked', false,
          'unitPriceCents', 250, 'purchaseQuantity', 10,
          'totalPriceCents', 2504, 'purchaseOccurrenceId', null,
          'sortOrder', 0
        ),
        9
      )
    )->>'status'
  ),
  'applied',
  'a later exact-ratio scenario can be prepared while unchecked'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000ea',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 6,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '10', 'checked', true,
          'unitPriceCents', 250, 'purchaseQuantity', 10,
          'totalPriceCents', 2504,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000e3',
          'sortOrder', 0
        ),
        10
      )
    )->>'status'
  ),
  'applied',
  'a different exact ratio with the same rounded cent records separately'
);

select is(
  (
    select count(*)::integer
    from public.household_grocery_price_history
    where item_name_normalized = 'milk' and store_name = 'Market'
  ),
  2,
  'dedupe compares exact total-to-quantity ratios'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000eb',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 7,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '5', 'checked', false,
          'unitPriceCents', 250, 'purchaseQuantity', 5,
          'totalPriceCents', 1252, 'purchaseOccurrenceId', null,
          'sortOrder', 0
        ),
        11
      )
    )->>'status'
  ),
  'applied',
  'an equivalent ratio can be prepared for a new occurrence'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000ec',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 8,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Milk', 'quantity', '5', 'checked', true,
          'unitPriceCents', 250, 'purchaseQuantity', 5,
          'totalPriceCents', 1252,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000e4',
          'sortOrder', 0
        ),
        12
      )
    )->>'status'
  ),
  'applied',
  'an equivalent exact ratio is recorded through its new occurrence'
);

select is(
  (
    select jsonb_build_object(
      'count', count(*),
      'quantity', max(purchase_quantity)
        filter (where purchase_occurrence_id =
          '60000000-0000-4000-8000-0000000000e4'),
      'total', max(total_price_cents)
        filter (where purchase_occurrence_id =
          '60000000-0000-4000-8000-0000000000e4')
    )
    from public.household_grocery_price_history
    where item_name_normalized = 'milk' and store_name = 'Market'
  ),
  '{"count":2,"quantity":5,"total":1252}'::jsonb,
  'equivalent fractions dedupe while preserving latest exact values'
);

-- The bucket includes list identity and the immutable store-name snapshot.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000ed',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 9,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e2',
          'name', 'Milk', 'quantity', '5', 'checked', false,
          'unitPriceCents', 250, 'purchaseQuantity', 5,
          'totalPriceCents', 1252, 'purchaseOccurrenceId', null,
          'sortOrder', 0
        ),
        13
      )
    )->>'status'
  ),
  'applied',
  'an item can move stores between purchase occurrences'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000ee',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 10,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e2',
          'name', 'Milk', 'quantity', '5', 'checked', true,
          'unitPriceCents', 250, 'purchaseQuantity', 5,
          'totalPriceCents', 1252,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000e5',
          'sortOrder', 0
        ),
        14
      )
    )->>'status'
  ),
  'applied',
  'the same ratio at a different store records separately'
);

reset role;
update public.household_grocery_lists
set name = 'Superstore'
where id = '30000000-0000-4000-8000-0000000000e2';
set local role authenticated;

select is(
  (
    select store_name
    from public.household_grocery_price_history
    where purchase_occurrence_id =
      '60000000-0000-4000-8000-0000000000e5'
  ),
  'Warehouse',
  'renaming a list does not rewrite an existing store snapshot'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000ef',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 11,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e2',
          'name', 'Milk', 'quantity', '5', 'checked', false,
          'unitPriceCents', 250, 'purchaseQuantity', 5,
          'totalPriceCents', 1252, 'purchaseOccurrenceId', null,
          'sortOrder', 0
        ),
        15
      )
    )->>'status'
  ),
  'applied',
  'a renamed store can begin another occurrence'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000f0',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000e3', 12,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e2',
          'name', 'Milk', 'quantity', '5', 'checked', true,
          'unitPriceCents', 250, 'purchaseQuantity', 5,
          'totalPriceCents', 1252,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000e6',
          'sortOrder', 0
        ),
        16
      )
    )->>'status'
  ),
  'applied',
  'the renamed store snapshot forms a distinct history bucket'
);

select is(
  (
    select count(distinct store_name)::integer
    from public.household_grocery_price_history
    where item_name_normalized = 'milk'
      and list_id = '30000000-0000-4000-8000-0000000000e2'
  ),
  2,
  'list identity plus immutable store snapshot participates in dedupe'
);

-- Late price entry uses the original server checked_at, not edit time.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000f1',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000f1', null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Bread', 'quantity', null, 'checked', false,
          'unitPriceCents', null, 'purchaseQuantity', null,
          'totalPriceCents', null, 'purchaseOccurrenceId', null,
          'sortOrder', 1
        ),
        17
      )
    )->>'status'
  ),
  'applied',
  'an unpriced canonical item can be created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000f2',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000f1', 1,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Bread', 'quantity', null, 'checked', true,
          'unitPriceCents', null, 'purchaseQuantity', null,
          'totalPriceCents', null,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000f1',
          'sortOrder', 1
        ),
        18
      )
    )->>'status'
  ),
  'applied',
  'an unpriced purchase occurrence can be checked'
);

create temporary table late_bread_purchase (
  checked_at timestamptz not null
) on commit drop;
insert into late_bread_purchase
select checked_at from public.household_grocery_items
where id = '50000000-0000-4000-8000-0000000000f1';

select pg_sleep(0.002);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000f3',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000f1', 2,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Bread', 'quantity', '2', 'checked', true,
          'unitPriceCents', 350, 'purchaseQuantity', 2,
          'totalPriceCents', 700,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000f1',
          'sortOrder', 1
        ),
        19
      )
    )->>'status'
  ),
  'applied',
  'a late price can be added to an existing checked occurrence'
);

select is(
  (
    select recorded_at
    from public.household_grocery_price_history
    where purchase_occurrence_id =
      '60000000-0000-4000-8000-0000000000f1'
  ),
  (select checked_at from late_bread_purchase),
  'late history uses the original checked_at purchase date'
);

-- Editing an occurrence into an existing price bucket merges deterministically
-- and keeps the edited occurrence's checked date and row identity.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000f4',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000f4', null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Coffee', 'quantity', '1', 'checked', false,
          'unitPriceCents', 100, 'purchaseQuantity', 1,
          'totalPriceCents', 100, 'purchaseOccurrenceId', null,
          'sortOrder', 2
        ),
        20
      )
    )->>'status'
  ),
  'applied',
  'a collision test item is created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000f5',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000f4', 1,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Coffee', 'quantity', '1', 'checked', true,
          'unitPriceCents', 100, 'purchaseQuantity', 1,
          'totalPriceCents', 100,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000f4',
          'sortOrder', 2
        ),
        21
      )
    )->>'status'
  ),
  'applied',
  'the first collision bucket is recorded'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000f6',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000f4', 2,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Coffee', 'quantity', '1', 'checked', false,
          'unitPriceCents', 200, 'purchaseQuantity', 1,
          'totalPriceCents', 200, 'purchaseOccurrenceId', null,
          'sortOrder', 2
        ),
        22
      )
    )->>'status'
  ),
  'applied',
  'the collision item is reset with a different price'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000f7',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000f4', 3,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Coffee', 'quantity', '1', 'checked', true,
          'unitPriceCents', 200, 'purchaseQuantity', 1,
          'totalPriceCents', 200,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000f5',
          'sortOrder', 2
        ),
        23
      )
    )->>'status'
  ),
  'applied',
  'the second collision bucket is recorded'
);

create temporary table collision_purchase (
  checked_at timestamptz not null,
  history_id uuid not null
) on commit drop;
insert into collision_purchase
select item.checked_at, history.id
from public.household_grocery_items item
join public.household_grocery_price_history history
  on history.purchase_occurrence_id = item.purchase_occurrence_id
where item.id = '50000000-0000-4000-8000-0000000000f4';

select pg_sleep(0.002);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000f8',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000f4', 4,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Coffee', 'quantity', '2', 'checked', true,
          'unitPriceCents', 100, 'purchaseQuantity', 2,
          'totalPriceCents', 200,
          'purchaseOccurrenceId', '60000000-0000-4000-8000-0000000000f5',
          'sortOrder', 2
        ),
        24
      )
    )->>'status'
  ),
  'applied',
  'editing an occurrence into another exact-ratio bucket applies'
);

select is(
  (
    select jsonb_build_object(
      'count', count(*),
      'sameId', bool_and(id = (select history_id from collision_purchase)),
      'sameDate', bool_and(recorded_at = (
        select checked_at from collision_purchase
      )),
      'occurrence', max(purchase_occurrence_id::text)
    )
    from public.household_grocery_price_history
    where item_name_normalized = 'coffee'
  ),
  '{"count":1,"sameId":true,"sameDate":true,"occurrence":"60000000-0000-4000-8000-0000000000f5"}'::jsonb,
  'merge collision retains the edited purchase row and checked date'
);

-- Legacy web payloads remain byte-for-byte valid and derive canonical values.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000f9',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000f9', null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Legacy eggs', 'quantity', null, 'checked', false,
          'unitPriceCents', 450, 'sortOrder', 3
        ),
        25
      )
    )->>'status'
  ),
  'applied',
  'the original six-key web Grocery payload remains valid'
);

select is(
  (
    select jsonb_build_object(
      'itemQuantity', item.purchase_quantity,
      'itemTotal', item.total_price_cents,
      'historyQuantity', history.purchase_quantity,
      'historyTotal', history.total_price_cents,
      'source', history.source_item_id,
      'store', history.store_name
    )
    from public.household_grocery_items item
    join public.household_grocery_price_history history
      on history.source_item_id = item.id
    where item.id = '50000000-0000-4000-8000-0000000000f9'
  ),
  jsonb_build_object(
    'itemQuantity', 1,
    'itemTotal', 450,
    'historyQuantity', 1,
    'historyTotal', 450,
    'source', '50000000-0000-4000-8000-0000000000f9'::uuid,
    'store', 'Market'
  ),
  'legacy prices derive quantity one, total equal to price, and snapshots'
);

-- Tenant ownership and authoritative list lookup happen server-side.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000fa',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000fa', null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000ef',
          'name', 'Foreign item', 'quantity', null, 'checked', false,
          'unitPriceCents', null, 'purchaseQuantity', null,
          'totalPriceCents', null, 'purchaseOccurrenceId', null,
          'sortOrder', 0
        ),
        26
      )
    )->>'code'
  ),
  'invalid_list',
  'a list from another household is rejected without mutation'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e3', true
);

select throws_ok(
  $$
    select public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000fb',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000fb', null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e1',
          'name', 'Outsider item', 'quantity', null, 'checked', false,
          'unitPriceCents', null, 'purchaseQuantity', null,
          'totalPriceCents', null, 'purchaseOccurrenceId', null,
          'sortOrder', 0
        ),
        27
      )
    )
  $$,
  '42501',
  'caller is not a member of the household',
  'an outsider cannot apply a Grocery operation'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e2', true
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000fc',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.upsert', 'grocery_item',
        '50000000-0000-4000-8000-0000000000fc', null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000e2',
          'name', 'Partner item', 'quantity', null, 'checked', false,
          'unitPriceCents', null, 'purchaseQuantity', null,
          'totalPriceCents', null, 'purchaseOccurrenceId', null,
          'sortOrder', 4
        ),
        28
      )
    )->>'status'
  ),
  'applied',
  'another household member can create an item'
);

select is(
  (
    select created_by
    from public.household_grocery_items
    where id = '50000000-0000-4000-8000-0000000000fc'
  ),
  '00000000-0000-4000-8000-0000000000e2'::uuid,
  'the server records the authenticated actor as item creator'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e1', true
);

-- A stale settings duplicate must not replay its post-processing after a newer
-- settings update has won.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000fd',
        '10000000-0000-4000-8000-0000000000e1',
        'settings.update', 'settings',
        '00000000-0000-4000-8000-0000000000e1', null,
        '{"displayName":"Grocery Owner","mobileNavigation":["notes","trips","groceries"],"suppressUnpricedPurchaseWarning":true}',
        29
      )
    )->>'status'
  ),
  'applied',
  'the first profile preference update applies'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000fe',
        '10000000-0000-4000-8000-0000000000e1',
        'settings.update', 'settings',
        '00000000-0000-4000-8000-0000000000e1', 1,
        '{"mobileNavigation":["ledger","groceries","notes"],"suppressUnpricedPurchaseWarning":false}',
        30
      )
    )->>'status'
  ),
  'applied',
  'the newer profile preference update applies'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000fd',
        '10000000-0000-4000-8000-0000000000e1',
        'settings.update', 'settings',
        '00000000-0000-4000-8000-0000000000e1', null,
        '{"displayName":"Grocery Owner","mobileNavigation":["notes","trips","groceries"],"suppressUnpricedPurchaseWarning":true}',
        29
      )
    )->>'status'
  ),
  'duplicate',
  'replaying the older settings command returns duplicate'
);

select is(
  (
    select jsonb_build_object(
      'navigation', mobile_navigation,
      'suppressed', suppress_unpriced_purchase_warning,
      'revision', revision
    )
    from public.profiles
    where user_id = '00000000-0000-4000-8000-0000000000e1'
  ),
  '{"navigation":["ledger","groceries","notes"],"suppressed":false,"revision":2}'::jsonb,
  'a duplicate settings replay is a true no-op after a newer update'
);

-- Item and list deletion retain historical metadata. Source item is deliberately
-- not a foreign key; list_id keeps its existing ON DELETE SET NULL behavior.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000ff',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.item.delete', 'grocery_item',
        '50000000-0000-4000-8000-0000000000f1', 3,
        '{}'::jsonb,
        31
      )
    )->>'status'
  ),
  'applied',
  'a purchased source item can be deleted'
);

select is(
  (
    select source_item_id
    from public.household_grocery_price_history
    where purchase_occurrence_id =
      '60000000-0000-4000-8000-0000000000f1'
  ),
  '50000000-0000-4000-8000-0000000000f1'::uuid,
  'history retains source item identity after item deletion'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-000000000100',
        '10000000-0000-4000-8000-0000000000e1',
        'grocery.list.delete', 'grocery_list',
        '30000000-0000-4000-8000-0000000000e1', null,
        '{}'::jsonb,
        32
      )
    )->>'status'
  ),
  'applied',
  'the source Grocery list can be deleted'
);

select ok(
  exists (
    select 1
    from public.household_grocery_price_history
    where purchase_occurrence_id =
      '60000000-0000-4000-8000-0000000000f1'
      and list_id is null
      and store_name = 'Market'
      and source_item_id = '50000000-0000-4000-8000-0000000000f1'
      and purchase_quantity = 2
      and total_price_cents = 700
  ),
  'history survives list deletion with immutable purchase metadata'
);

select is(
  (
    select count(*)::integer
    from public.operation_receipts
    where operation_id = '40000000-0000-4000-8000-0000000000e4'
  ),
  1,
  'idempotent Grocery replay stores one receipt'
);

select is(
  (
    select count(*)::integer
    from public.household_change_log
    where operation_id = '40000000-0000-4000-8000-0000000000e4'
  ),
  1,
  'idempotent Grocery replay stores one change-log row'
);

select * from finish();
rollback;
