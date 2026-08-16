begin;

select plan(2);

select is(
  obj_description(
    'public.calendar_event_deletion_snapshots'::regclass,
    'pg_class'
  ),
  'Internal server-only table: household_id scopes security-definer calendar deletion snapshot work; RLS is intentionally deny-all and client grants are revoked, so no tenant client policy is defined.',
  'calendar deletion snapshots document the internal deny-all RLS exception'
);

select is(
  obj_description(
    'public.household_grocery_purchase_occurrences'::regclass,
    'pg_class'
  ),
  'Internal server-only table: household_id scopes security-definer purchase-occurrence replay protection; RLS is intentionally deny-all and client grants are revoked, so no tenant client policy is defined.',
  'grocery purchase occurrences document the internal deny-all RLS exception'
);

select * from finish();
rollback;
