begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
set local timezone = 'UTC';

select no_plan();

-- Three fixed identities: A onboards, B is invited, C is a spare third user.
insert into auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated',
   'admin-a@example.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated',
   'admin-b@example.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000c3', 'authenticated', 'authenticated',
   'admin-c@example.test', '', now(), now(), now());

-- auth.uid() reads request.jwt.claim.sub; empty string => unauthenticated.
create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, true);
$$;

-- --- Authentication gate -----------------------------------------------------
select pg_temp.act_as('');
select throws_ok(
  $$ select public.onboard_household('X', 'Y') $$,
  '42501',
  null,
  'onboarding requires authentication'
);

-- --- Onboarding --------------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a1');
select is(
  (public.onboard_household('Alice', 'Casa'))->>'status', 'ok',
  'first user onboards a new household'
);
select is(
  (select member_role from public.household_members
     where user_id = '00000000-0000-4000-8000-0000000000a1'),
  'owner', 'onboarding user becomes owner'
);
select is(
  (select count(*)::int from public.households
     where owner_user_id = '00000000-0000-4000-8000-0000000000a1'),
  1, 'a household is created and owned by the onboarding user'
);
select is(
  (select display_name from public.profiles
     where user_id = '00000000-0000-4000-8000-0000000000a1'),
  'Alice', 'a profile is created for the onboarding user'
);
select is(
  (public.onboard_household('Alice', 'Casa2'))->>'code', 'already_member',
  'a user already in a household cannot onboard again'
);

select set_config(
  'tests.hh',
  (select household_id::text from public.household_members
     where user_id = '00000000-0000-4000-8000-0000000000a1'),
  true
);

-- --- Invite creation authorization ------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b2');
select is(
  (public.create_household_invite())->>'code', 'not_a_member',
  'a non-member cannot create an invite'
);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000a1');
select set_config('tests.invite', (public.create_household_invite())::text, true);
select is(
  (current_setting('tests.invite')::jsonb)->>'status', 'ok',
  'the owner creates an invite'
);
select ok(
  (current_setting('tests.invite')::jsonb->'details'->>'code')
    ~ '^[A-Za-z0-9_-]{16,64}$',
  'the invite code is a url-safe token'
);

-- --- Redemption --------------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b2');
select is(
  (public.redeem_household_invite(
    current_setting('tests.invite')::jsonb->'details'->>'code', 'Bob'
  ))->>'status', 'ok',
  'a second user redeems the invite and joins'
);
select is(
  (select count(*)::int from public.household_members
     where household_id = current_setting('tests.hh')::uuid),
  2, 'the household now has two members'
);
select is(
  (select member_role from public.household_members
     where user_id = '00000000-0000-4000-8000-0000000000b2'),
  'member', 'the redeeming user joins as a member'
);

-- single-use: the spent invite cannot be redeemed again
select pg_temp.act_as('00000000-0000-4000-8000-0000000000c3');
select is(
  (public.redeem_household_invite(
    current_setting('tests.invite')::jsonb->'details'->>'code', 'Cat'
  ))->>'code', 'invite_redeemed',
  'a redeemed invite cannot be redeemed again'
);
select is(
  (public.redeem_household_invite('short', 'Cat'))->>'code', 'invalid_code',
  'a malformed invite code is rejected'
);
select is(
  (public.redeem_household_invite('AAAAAAAAAAAAAAAA', 'Cat'))->>'code',
  'invite_not_found',
  'an unknown invite code is rejected'
);

-- two-member cap: a full household cannot mint another invite
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a1');
select is(
  (public.create_household_invite())->>'code', 'household_full',
  'a full household cannot create a new invite'
);

-- --- Ownership transfer ------------------------------------------------------
select is(
  (public.transfer_household_ownership(
    '00000000-0000-4000-8000-0000000000b2'
  ))->>'status', 'ok',
  'the owner transfers ownership to the partner'
);
select is(
  (select owner_user_id::text from public.households
     where id = current_setting('tests.hh')::uuid),
  '00000000-0000-4000-8000-0000000000b2',
  'the household owner column is updated'
);
select is(
  (select member_role from public.household_members
     where user_id = '00000000-0000-4000-8000-0000000000b2'),
  'owner', 'the new owner has the owner role'
);
select is(
  (select member_role from public.household_members
     where user_id = '00000000-0000-4000-8000-0000000000a1'),
  'member', 'the former owner is demoted to member'
);
select is(
  (public.transfer_household_ownership(
    '00000000-0000-4000-8000-0000000000b2'
  ))->>'code', 'not_owner',
  'a non-owner cannot transfer ownership'
);

-- --- Member removal ----------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b2');
select is(
  (public.remove_household_member(
    '00000000-0000-4000-8000-0000000000a1'
  ))->>'status', 'ok',
  'the owner removes the other member'
);
select is(
  (select count(*)::int from public.household_members
     where user_id = '00000000-0000-4000-8000-0000000000a1'),
  0, 'the removed member no longer belongs to the household'
);
select is(
  (public.remove_household_member(
    '00000000-0000-4000-8000-0000000000b2'
  ))->>'code', 'invalid_target',
  'the owner cannot remove themselves via member removal'
);

-- --- Household deletion cascade ---------------------------------------------
insert into public.calendar_events (
  id, household_id, created_by, title, all_day, start_at, end_at, event_timezone
)
values (
  '31000000-0000-4000-8000-0000000000e1',
  current_setting('tests.hh')::uuid,
  '00000000-0000-4000-8000-0000000000b2',
  'Trip', false,
  '2026-08-01T10:00:00.000Z', '2026-08-01T11:00:00.000Z', 'UTC'
);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000a1');
select is(
  (public.delete_household())->>'code', 'not_a_member',
  'a non-member cannot delete the household'
);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000b2');
select is(
  (public.delete_household())->>'status', 'ok',
  'the owner deletes the household'
);
select is(
  (select count(*)::int from public.households
     where id = current_setting('tests.hh')::uuid),
  0, 'the household row is gone'
);
select is(
  (select count(*)::int from public.calendar_events
     where household_id = current_setting('tests.hh')::uuid),
  0, 'household content is cascade-deleted'
);
select is(
  (select count(*)::int from public.household_members
     where household_id = current_setting('tests.hh')::uuid),
  0, 'memberships are cascade-deleted'
);

-- --- Grants ------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.onboard_household(text,text)', 'execute'),
  'authenticated may call onboarding'
);
select ok(
  not has_function_privilege('anon', 'public.onboard_household(text,text)', 'execute'),
  'anon may not call onboarding'
);
select ok(
  has_function_privilege('authenticated', 'public.redeem_household_invite(text,text)', 'execute'),
  'authenticated (not-yet-member) may redeem an invite'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.mobile_admin_rejected(text,text,jsonb)', 'execute'
  ),
  'the internal rejection helper is not client-callable'
);

select * from finish();
rollback;
