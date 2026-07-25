-- Household administration operations. Unlike apply_household_operation (which
-- assumes the caller is already a member of the target household and serializes
-- data mutations), these are onboarding/identity actions with their own auth
-- shapes: onboarding has no household yet, and invite redemption is performed by
-- a user who is not yet a member. All are security-definer, take the actor from
-- auth.uid(), and return the shared HouseholdAdminResult shape
-- ({status:'ok',details} | {status:'rejected',code,reason,details}). Direct DML
-- on households/members/profiles/invites remains revoked from clients; these
-- functions are the only authenticated write path for identity.
--
-- Account deletion (auth.users removal + created_by reconciliation) and any
-- push side effects are handled by the service-role Edge Function in Task 3C.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.mobile_admin_rejected(
  code text,
  reason text,
  details jsonb default '{}'::jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'status', 'rejected',
    'code', code,
    'reason', reason,
    'details', coalesce(details, '{}'::jsonb)
  );
$$;

-- First OAuth user creates a household and becomes its owner.
create or replace function public.onboard_household(
  display_name text,
  household_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  clean_display text := btrim(coalesce(display_name, ''));
  clean_household text := btrim(coalesce(household_name, ''));
  new_household_id uuid;
begin
  if actor is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  if clean_display = '' or length(clean_display) > 80
     or clean_household = '' or length(clean_household) > 80 then
    return public.mobile_admin_rejected(
      'invalid_name',
      'Display and household names must be 1-80 characters.'
    );
  end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    return public.mobile_admin_rejected(
      'already_member',
      'This account already belongs to a household.'
    );
  end if;

  insert into public.profiles (user_id, display_name)
  values (actor, clean_display)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        updated_at = now(),
        revision = profiles.revision + 1;

  new_household_id := gen_random_uuid();
  insert into public.households (id, name, owner_user_id)
  values (new_household_id, clean_household, actor);

  insert into public.household_members (
    id, household_id, user_id, display_name, member_role
  )
  values (gen_random_uuid(), new_household_id, actor, clean_display, 'owner');

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object('householdId', new_household_id)
  );
exception
  when unique_violation then
    -- Concurrent onboard for the same actor (household_members.user_id unique).
    return public.mobile_admin_rejected(
      'already_member',
      'This account already belongs to a household.'
    );
end;
$$;

-- Owner generates a single-use, 7-day invite. Creating a new invite supersedes
-- any prior active one (regeneration). Returns the raw code once; only its hash
-- is stored.
create or replace function public.create_household_invite()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  actor_household uuid;
  actor_role text;
  member_count integer;
  raw_token text;
  new_invite_id uuid;
  expires timestamptz := now() + interval '7 days';
begin
  if actor is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  select household_id, member_role into actor_household, actor_role
    from public.household_members where user_id = actor;
  if actor_household is null then
    return public.mobile_admin_rejected(
      'not_a_member', 'You are not a member of a household.'
    );
  end if;
  if actor_role <> 'owner' then
    return public.mobile_admin_rejected(
      'not_owner', 'Only the household owner can create invites.'
    );
  end if;

  perform 1 from public.households where id = actor_household for update;

  select count(*) into member_count
    from public.household_members where household_id = actor_household;
  if member_count >= 2 then
    return public.mobile_admin_rejected(
      'household_full', 'This household already has two members.'
    );
  end if;

  update public.household_invites
    set revoked_at = now(), updated_at = now(), revision = revision + 1
    where household_id = actor_household
      and redeemed_at is null
      and revoked_at is null;

  raw_token := translate(
    replace(encode(extensions.gen_random_bytes(32), 'base64'), E'\n', ''),
    '+/=', '-_'
  );
  new_invite_id := gen_random_uuid();
  insert into public.household_invites (
    id, household_id, token_hash, created_by, expires_at
  )
  values (
    new_invite_id,
    actor_household,
    extensions.digest(raw_token, 'sha256'),
    actor,
    expires
  );

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object(
      'inviteId', new_invite_id,
      'code', raw_token,
      'expiresAt', expires
    )
  );
end;
$$;

-- Owner revokes an active invite.
create or replace function public.revoke_household_invite(invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  actor_household uuid;
  actor_role text;
  affected integer;
begin
  if actor is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  select household_id, member_role into actor_household, actor_role
    from public.household_members where user_id = actor;
  if actor_household is null then
    return public.mobile_admin_rejected(
      'not_a_member', 'You are not a member of a household.'
    );
  end if;
  if actor_role <> 'owner' then
    return public.mobile_admin_rejected(
      'not_owner', 'Only the household owner can revoke invites.'
    );
  end if;

  perform 1 from public.households where id = actor_household for update;

  update public.household_invites
    set revoked_at = now(), updated_at = now(), revision = revision + 1
    where id = invite_id
      and household_id = actor_household
      and redeemed_at is null
      and revoked_at is null;
  get diagnostics affected = row_count;
  if affected = 0 then
    return public.mobile_admin_rejected(
      'invite_not_found',
      'No active invite to revoke.',
      jsonb_build_object('inviteId', invite_id)
    );
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object('inviteId', invite_id)
  );
end;
$$;

-- A second user redeems an invite and joins the household. Serialized under the
-- household lock so the two-member cap and single-use guarantees hold against a
-- concurrent redemption.
create or replace function public.redeem_household_invite(
  code text,
  display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  clean_display text := btrim(coalesce(display_name, ''));
  inv public.household_invites%rowtype;
  member_count integer;
begin
  if actor is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  if clean_display = '' or length(clean_display) > 80 then
    return public.mobile_admin_rejected(
      'invalid_name', 'Display name must be 1-80 characters.'
    );
  end if;
  if code !~ '^[A-Za-z0-9_-]{16,64}$' then
    return public.mobile_admin_rejected(
      'invalid_code', 'Invite code is malformed.'
    );
  end if;

  select * into inv from public.household_invites
    where token_hash = extensions.digest(code, 'sha256');
  if inv.id is null then
    return public.mobile_admin_rejected(
      'invite_not_found', 'That invite does not exist.'
    );
  end if;

  perform 1 from public.households where id = inv.household_id for update;
  select * into inv from public.household_invites where id = inv.id;

  if inv.revoked_at is not null then
    return public.mobile_admin_rejected('invite_revoked', 'That invite was revoked.');
  end if;
  if inv.redeemed_at is not null then
    return public.mobile_admin_rejected('invite_redeemed', 'That invite was already used.');
  end if;
  if inv.expires_at <= now() then
    return public.mobile_admin_rejected('invite_expired', 'That invite has expired.');
  end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    return public.mobile_admin_rejected(
      'already_member', 'This account already belongs to a household.'
    );
  end if;
  select count(*) into member_count
    from public.household_members where household_id = inv.household_id;
  if member_count >= 2 then
    return public.mobile_admin_rejected(
      'household_full', 'This household already has two members.'
    );
  end if;

  insert into public.profiles (user_id, display_name)
  values (actor, clean_display)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        updated_at = now(),
        revision = profiles.revision + 1;

  insert into public.household_members (
    id, household_id, user_id, display_name, member_role
  )
  values (gen_random_uuid(), inv.household_id, actor, clean_display, 'member');

  update public.household_invites
    set redeemed_at = now(), redeemed_by = actor, updated_at = now(),
        revision = revision + 1
    where id = inv.id;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object('householdId', inv.household_id)
  );
exception
  when unique_violation then
    return public.mobile_admin_rejected(
      'already_member', 'This account already belongs to a household.'
    );
end;
$$;

-- Owner hands ownership to the other member; roles swap atomically.
create or replace function public.transfer_household_ownership(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  actor_household uuid;
  actor_role text;
  target_role text;
begin
  if actor is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  select household_id, member_role into actor_household, actor_role
    from public.household_members where user_id = actor;
  if actor_household is null then
    return public.mobile_admin_rejected('not_a_member', 'You are not a member of a household.');
  end if;
  if actor_role <> 'owner' then
    return public.mobile_admin_rejected('not_owner', 'Only the household owner can transfer ownership.');
  end if;
  if target_user_id = actor then
    return public.mobile_admin_rejected('invalid_target', 'You already own this household.');
  end if;

  perform 1 from public.households where id = actor_household for update;

  select member_role into target_role from public.household_members
    where household_id = actor_household and user_id = target_user_id;
  if target_role is null then
    return public.mobile_admin_rejected('target_not_member', 'That user is not in your household.');
  end if;

  update public.households
    set owner_user_id = target_user_id, updated_at = now(), revision = revision + 1
    where id = actor_household;
  update public.household_members
    set member_role = 'owner', updated_at = now(), revision = revision + 1
    where household_id = actor_household and user_id = target_user_id;
  update public.household_members
    set member_role = 'member', updated_at = now(), revision = revision + 1
    where household_id = actor_household and user_id = actor;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object('householdId', actor_household, 'ownerUserId', target_user_id)
  );
end;
$$;

-- Owner removes the other member. The removed member's household content stays
-- with the household; their profile/account are untouched (they can rejoin or
-- onboard a new household).
create or replace function public.remove_household_member(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  actor_household uuid;
  actor_role text;
  target_role text;
begin
  if actor is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  select household_id, member_role into actor_household, actor_role
    from public.household_members where user_id = actor;
  if actor_household is null then
    return public.mobile_admin_rejected('not_a_member', 'You are not a member of a household.');
  end if;
  if actor_role <> 'owner' then
    return public.mobile_admin_rejected('not_owner', 'Only the household owner can remove a member.');
  end if;
  if target_user_id = actor then
    return public.mobile_admin_rejected(
      'invalid_target',
      'Transfer ownership or delete the household to remove yourself.'
    );
  end if;

  perform 1 from public.households where id = actor_household for update;

  select member_role into target_role from public.household_members
    where household_id = actor_household and user_id = target_user_id;
  if target_role is null then
    return public.mobile_admin_rejected('target_not_member', 'That user is not in your household.');
  end if;

  delete from public.household_members
    where household_id = actor_household and user_id = target_user_id;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object('removedUserId', target_user_id)
  );
end;
$$;

-- Owner deletes the whole household; the cascade removes all household-scoped
-- content, memberships, and invites. auth.users rows are untouched.
create or replace function public.delete_household()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  actor_household uuid;
  actor_role text;
begin
  if actor is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  select household_id, member_role into actor_household, actor_role
    from public.household_members where user_id = actor;
  if actor_household is null then
    return public.mobile_admin_rejected('not_a_member', 'You are not a member of a household.');
  end if;
  if actor_role <> 'owner' then
    return public.mobile_admin_rejected('not_owner', 'Only the household owner can delete the household.');
  end if;

  perform 1 from public.households where id = actor_household for update;
  delete from public.households where id = actor_household;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object('householdId', actor_household)
  );
end;
$$;

-- Grants: internal rejection helper stays private; the seven admin entry points
-- are callable only by authenticated users (invite redemption is called by a
-- yet-to-be-member authenticated user, so this role is correct there too).
revoke execute on function public.mobile_admin_rejected(text, text, jsonb)
  from public, anon, authenticated;

revoke execute on function public.onboard_household(text, text) from public, anon;
revoke execute on function public.create_household_invite() from public, anon;
revoke execute on function public.revoke_household_invite(uuid) from public, anon;
revoke execute on function public.redeem_household_invite(text, text) from public, anon;
revoke execute on function public.transfer_household_ownership(uuid) from public, anon;
revoke execute on function public.remove_household_member(uuid) from public, anon;
revoke execute on function public.delete_household() from public, anon;

grant execute on function public.onboard_household(text, text) to authenticated;
grant execute on function public.create_household_invite() to authenticated;
grant execute on function public.revoke_household_invite(uuid) to authenticated;
grant execute on function public.redeem_household_invite(text, text) to authenticated;
grant execute on function public.transfer_household_ownership(uuid) to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;
grant execute on function public.delete_household() to authenticated;
