-- Regression test for the bug fixed by
-- 20260727024436_grocery_price_history_persists_list_deletion.sql:
--
-- `household_grocery_price_history` is meant to be permanent, household-wide
-- purchase history (see mobile/src/features/groceries/data.ts's
-- cheapestPriceHistory / useGroceryList, which already tolerates a missing
-- source list via `household_grocery_lists?.name ?? 'Unknown list'`). But its
-- `list_id` foreign key used to cascade-delete on the source grocery list's
-- deletion, so deleting a list (a normal action, e.g. starting a fresh
-- weekly list) silently erased every price ever recorded through that
-- list's items — reproducing the reported symptom of "I added the same
-- item again and it doesn't show the history."
--
-- This test creates a list, records a price through it, deletes the list,
-- and asserts the price-history row survives (with its list_id nulled
-- rather than the row disappearing), then confirms a later purchase of the
-- same item name is recorded alongside it.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
set local timezone = 'UTC';

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values (
  '00000000-0000-4000-8000-0000000000d1',
  'authenticated', 'authenticated',
  'grocery-history@example.test', '',
  now(), now(), now()
);

insert into public.households (id, name, owner_user_id)
values (
  '10000000-0000-4000-8000-0000000000d1',
  'Grocery history household',
  '00000000-0000-4000-8000-0000000000d1'
);

insert into public.household_members (
  id, household_id, user_id, display_name, member_role
)
values (
  '11000000-0000-4000-8000-0000000000d1',
  '10000000-0000-4000-8000-0000000000d1',
  '00000000-0000-4000-8000-0000000000d1',
  'History Tester',
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
    'deviceId', '20000000-0000-4000-8000-0000000000d1',
    'localSequence', local_sequence,
    'householdId', household_id,
    'type', operation_type,
    'entityType', entity_type,
    'entityId', entity_id,
    'baseRevision', base_revision,
    'enqueuedAt', '2026-07-27T00:00:00.000Z',
    'payload', payload
  );
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000d1', true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Week 1: create a list, buy Eggs at $3.49.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000d1',
        '10000000-0000-4000-8000-0000000000d1',
        'grocery.list.upsert',
        'grocery_list',
        '30000000-0000-4000-8000-0000000000d1',
        null,
        '{"name":"Week 1","sortOrder":0}',
        1
      )
    )->>'status'
  ),
  'applied',
  'Week 1 list is created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000d2',
        '10000000-0000-4000-8000-0000000000d1',
        'grocery.item.upsert',
        'grocery_item',
        '30000000-0000-4000-8000-0000000000d2',
        null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000d1',
          'name', 'Eggs',
          'quantity', null,
          'checked', true,
          'unitPriceCents', 349,
          'sortOrder', 0
        ),
        2
      )
    )->>'status'
  ),
  'applied',
  'Eggs is purchased in Week 1 at $3.49'
);

select is(
  (
    select count(*)::integer
    from public.household_grocery_price_history
    where household_id = '10000000-0000-4000-8000-0000000000d1'
      and item_name_normalized = 'eggs'
  ),
  1,
  'the $3.49 purchase is recorded in household-wide price history'
);

-- The user starts fresh: delete the Week 1 list entirely.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000d3',
        '10000000-0000-4000-8000-0000000000d1',
        'grocery.list.delete',
        'grocery_list',
        '30000000-0000-4000-8000-0000000000d1',
        1,
        '{}',
        3
      )
    )->>'status'
  ),
  'applied',
  'Week 1 list is deleted'
);

select is(
  (
    select count(*)::integer
    from public.household_grocery_lists
    where id = '30000000-0000-4000-8000-0000000000d1'
  ),
  0,
  'the Week 1 list row is really gone'
);

select is(
  (
    select count(*)::integer
    from public.household_grocery_price_history
    where household_id = '10000000-0000-4000-8000-0000000000d1'
      and item_name_normalized = 'eggs'
  ),
  1,
  'deleting the list does not erase the price recorded through it'
);

select is(
  (
    select list_id
    from public.household_grocery_price_history
    where household_id = '10000000-0000-4000-8000-0000000000d1'
      and item_name_normalized = 'eggs'
  ),
  null::uuid,
  'the surviving history row has its list reference nulled, not the row itself'
);

-- Week 2: a new list, Eggs purchased again at a different price.
select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000d4',
        '10000000-0000-4000-8000-0000000000d1',
        'grocery.list.upsert',
        'grocery_list',
        '30000000-0000-4000-8000-0000000000d3',
        null,
        '{"name":"Week 2","sortOrder":0}',
        4
      )
    )->>'status'
  ),
  'applied',
  'Week 2 list is created'
);

select is(
  (
    public.apply_household_operation(
      pg_temp.operation_command(
        '40000000-0000-4000-8000-0000000000d5',
        '10000000-0000-4000-8000-0000000000d1',
        'grocery.item.upsert',
        'grocery_item',
        '30000000-0000-4000-8000-0000000000d4',
        null,
        jsonb_build_object(
          'listId', '30000000-0000-4000-8000-0000000000d3',
          'name', 'Eggs',
          'quantity', null,
          'checked', true,
          'unitPriceCents', 399,
          'sortOrder', 0
        ),
        5
      )
    )->>'status'
  ),
  'applied',
  'Eggs is purchased in Week 2 at a new price'
);

select is(
  (
    select count(*)::integer
    from public.household_grocery_price_history
    where household_id = '10000000-0000-4000-8000-0000000000d1'
      and item_name_normalized = 'eggs'
  ),
  2,
  'household-wide price history now shows both purchases across both lists'
);

select * from finish();
rollback;
