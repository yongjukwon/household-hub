-- Regression: a member who joined by invite must be able to delete their
-- account. `household_invites.redeemed_by` previously used ON DELETE SET NULL,
-- which collided with the paired (redeemed_at, redeemed_by) check constraint
-- and made the `auth.users` deletion fail after
-- `admin_prepare_account_deletion` had already accepted it — the Edge Function
-- returned an internal error and the account survived.

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
  ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated',
   'invite-owner@example.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated',
   'invite-partner@example.test', '', now(), now(), now());

create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, true);
$$;

create temporary table invite_code (code text);

-- Build the household through the real onboarding path, so the invite row
-- under test is exactly the one the application produces.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000e1');

select is(
  public.onboard_household('Ann', 'Invite household') ->> 'status',
  'ok',
  'owner onboards'
);

insert into invite_code (code)
select public.create_household_invite() -> 'details' ->> 'code';

select isnt(
  (select code from invite_code),
  null,
  'the owner receives a raw invite code once'
);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000e2');

select is(
  public.redeem_household_invite((select code from invite_code), 'Ben')
    ->> 'status',
  'ok',
  'partner redeems the invite'
);

select is(
  (
    select count(*)::int
    from public.household_invites
    where redeemed_by = '00000000-0000-4000-8000-0000000000e2'
  ),
  1,
  'the spent invite records its redeemer'
);

-- Account deletion: the database side, then the auth.users removal the Edge
-- Function performs with the service role.
select is(
  public.admin_prepare_account_deletion(
    '00000000-0000-4000-8000-0000000000e2'
  ) ->> 'status',
  'ok',
  'the partner may delete their account'
);

select lives_ok(
  $$delete from auth.users where id = '00000000-0000-4000-8000-0000000000e2'$$,
  'removing the redeemer''s auth user no longer violates the invite constraint'
);

select is(
  (
    select count(*)::int
    from public.household_invites
    where household_id = (
      select id from public.households where name = 'Invite household'
    )
  ),
  0,
  'the spent invite goes with the account that redeemed it'
);

select is(
  (
    select count(*)::int
    from public.household_members
    where user_id = '00000000-0000-4000-8000-0000000000e2'
  ),
  0,
  'the departing member is out of the household'
);

select is(
  (select count(*)::int from public.households where name = 'Invite household'),
  1,
  'the household and its owner survive'
);

select * from finish();

rollback;
