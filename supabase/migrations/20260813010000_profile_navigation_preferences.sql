-- Profile preferences used by the native configurable navigation and grocery
-- purchase warning. This is forward-only: deployed operation migrations stay
-- immutable and the current RPC is wrapped rather than replaced wholesale.

create function public.mobile_valid_navigation(value jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select
    jsonb_typeof(value) = 'array'
    and jsonb_array_length(value) = 3
    and (
      select count(*) = 3
      from jsonb_array_elements_text(value)
    )
    and (
      select count(distinct item) = 3
      from jsonb_array_elements_text(value) as item
    )
    and not exists (
      select 1
      from jsonb_array_elements_text(value) as item
      where item not in ('groceries', 'ledger', 'notes', 'trips')
    );
$$;

alter table public.profiles
  add column if not exists mobile_navigation jsonb not null
    default '["groceries", "ledger", "trips"]'::jsonb,
  add column if not exists suppress_unpriced_purchase_warning boolean not null
    default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_mobile_navigation_valid'
  ) then
    alter table public.profiles
      add constraint profiles_mobile_navigation_valid
      check (public.mobile_valid_navigation(mobile_navigation));
  end if;
end;
$$;

alter function public.mobile_operation_payload_valid(text, jsonb)
  rename to mobile_operation_payload_valid_v1;

create function public.mobile_operation_payload_valid(
  operation_type text,
  payload jsonb
)
returns boolean
language plpgsql
stable
set search_path = pg_catalog, public
as $$
begin
  if operation_type <> 'settings.update' then
    return public.mobile_operation_payload_valid_v1(operation_type, payload);
  end if;

  if jsonb_typeof(payload) <> 'object'
     or not public.mobile_json_keys_valid(
       payload,
       array[]::text[],
       array[
         'displayName', 'appearance', 'notificationsEnabled',
         'mobileNavigation', 'suppressUnpricedPurchaseWarning'
       ]
     )
     or payload = '{}'::jsonb
  then
    return false;
  end if;

  if payload ? 'displayName'
     and (
       jsonb_typeof(payload->'displayName') <> 'string'
       or btrim(payload->>'displayName') = ''
     )
  then
    return false;
  end if;

  if payload ? 'appearance'
     and (
       jsonb_typeof(payload->'appearance') <> 'string'
       or payload->>'appearance' not in ('light', 'dark', 'system')
     )
  then
    return false;
  end if;

  if payload ? 'notificationsEnabled'
     and jsonb_typeof(payload->'notificationsEnabled') <> 'boolean'
  then
    return false;
  end if;

  if payload ? 'mobileNavigation'
     and not public.mobile_valid_navigation(payload->'mobileNavigation')
  then
    return false;
  end if;

  return not payload ? 'suppressUnpricedPurchaseWarning'
    or jsonb_typeof(payload->'suppressUnpricedPurchaseWarning') = 'boolean';
end;
$$;

revoke execute on function public.mobile_valid_navigation(jsonb)
  from public, anon, authenticated;
revoke execute on function public.mobile_operation_payload_valid(text, jsonb)
  from public, anon, authenticated;

alter function public.apply_household_operation(jsonb)
  rename to apply_household_operation_v2;

create function public.apply_household_operation(command jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  payload jsonb := command->'payload';
  result jsonb;
begin
  if command->>'type' <> 'settings.update'
     or not (
       payload ? 'mobileNavigation'
       or payload ? 'suppressUnpricedPurchaseWarning'
     )
  then
    return public.apply_household_operation_v2(command);
  end if;

  -- The renamed current RPC dynamically calls the new public payload
  -- validator. Passing the original command preserves validation of the new
  -- fields before its legacy settings block applies the existing fields.
  result := public.apply_household_operation_v2(command);

  if result->>'status' in ('applied', 'duplicate') then
    update public.profiles
    set
      mobile_navigation = case
        when payload ? 'mobileNavigation' then payload->'mobileNavigation'
        else mobile_navigation
      end,
      suppress_unpriced_purchase_warning = case
        when payload ? 'suppressUnpricedPurchaseWarning'
          then (payload->>'suppressUnpricedPurchaseWarning')::boolean
        else suppress_unpriced_purchase_warning
      end
    where user_id = (command->>'entityId')::uuid;
  end if;

  return result;
end;
$$;

revoke execute on function public.apply_household_operation_v2(jsonb)
  from public, anon, authenticated;
revoke execute on function public.apply_household_operation(jsonb)
  from public, anon;
grant execute on function public.apply_household_operation(jsonb)
  to authenticated, service_role;
