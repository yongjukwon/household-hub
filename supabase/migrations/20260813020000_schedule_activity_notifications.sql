-- Durable Schedule activity and snapshots. Visible Calendar activity is kept
-- until the recipient explicitly removes it; reminder rows remain push-only.

create table public.calendar_event_deletion_snapshots (
  household_id uuid not null references public.households(id) on delete cascade,
  event_id uuid not null,
  payload jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (household_id, event_id)
);

alter table public.calendar_event_deletion_snapshots enable row level security;
revoke all on table public.calendar_event_deletion_snapshots
  from public, anon, authenticated;

create function public.mobile_snapshot_deleted_calendar_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.calendar_event_deletion_snapshots (
    household_id,
    event_id,
    payload
  )
  values (
    old.household_id,
    old.id,
    jsonb_build_object(
      'title', old.title,
      'allDay', old.all_day,
      'startAt', old.start_at,
      'endAt', old.end_at,
      'startDate', old.start_date,
      'endDate', old.end_date,
      'timezone', old.event_timezone
    )
  )
  on conflict (household_id, event_id) do update
  set
    payload = excluded.payload,
    captured_at = now();
  return old;
end;
$$;

create trigger trg_calendar_events_snapshot_before_delete
  before delete on public.calendar_events
  for each row execute function public.mobile_snapshot_deleted_calendar_event();

create or replace function public.mobile_notify_calendar_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid;
  actor_name text;
  activity_kind text;
  event_snapshot jsonb;
begin
  if new.entity_type <> 'calendar_event' then
    return new;
  end if;

  select actor_user_id
  into actor
  from public.operation_receipts
  where operation_id = new.operation_id;
  if actor is null then
    return new;
  end if;

  select coalesce(member.display_name, profile.display_name, 'Someone')
  into actor_name
  from public.household_members member
  left join public.profiles profile on profile.user_id = member.user_id
  where member.household_id = new.household_id
    and member.user_id = actor;

  if new.change_kind = 'delete' then
    select snapshot.payload || jsonb_build_object('deletedAt', new.changed_at)
    into event_snapshot
    from public.calendar_event_deletion_snapshots snapshot
    where snapshot.household_id = new.household_id
      and snapshot.event_id = new.entity_id;
  else
    select jsonb_build_object(
      'title', event.title,
      'allDay', event.all_day,
      'startAt', event.start_at,
      'endAt', event.end_at,
      'startDate', event.start_date,
      'endDate', event.end_date,
      'timezone', event.event_timezone
    )
    into event_snapshot
    from public.calendar_events event
    where event.id = new.entity_id
      and event.household_id = new.household_id;
  end if;

  activity_kind := case
    when new.change_kind = 'delete' then 'calendar.event.deleted'
    when new.entity_revision = 1 then 'calendar.event.created'
    else 'calendar.event.updated'
  end;

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
  select
    gen_random_uuid(),
    new.household_id,
    member.user_id,
    actor,
    activity_kind,
    'calendar_event',
    new.entity_id,
    coalesce(event_snapshot, '{}'::jsonb) || jsonb_build_object(
      'actorName', coalesce(actor_name, 'Someone'),
      'operationId', new.operation_id,
      'serverSequence', new.server_sequence
    )
  from public.household_members member
  where member.household_id = new.household_id
    and member.user_id <> actor;

  if new.change_kind = 'delete' then
    delete from public.calendar_event_deletion_snapshots snapshot
    where snapshot.household_id = new.household_id
      and snapshot.event_id = new.entity_id;
  end if;

  return new;
end;
$$;

-- Preserve the latest operation contract and add the two removal families
-- without copying the full legacy validators into this forward migration.
alter function public.mobile_expected_entity_type(text)
  rename to mobile_expected_entity_type_v2;

create function public.mobile_expected_entity_type(operation_type text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when operation_type in ('notification.delete', 'notification.clear')
      then 'notification'
    else public.mobile_expected_entity_type_v2(operation_type)
  end;
$$;

alter function public.mobile_operation_payload_valid(text, jsonb)
  rename to mobile_operation_payload_valid_v2;

create function public.mobile_operation_payload_valid(
  operation_type text,
  payload jsonb
)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select case
    when operation_type in ('notification.delete', 'notification.clear')
      then jsonb_typeof(payload) = 'object' and payload = '{}'::jsonb
    else public.mobile_operation_payload_valid_v2(operation_type, payload)
  end;
$$;

create function public.mobile_apply_notification_removal(command jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  actor_id uuid;
  operation_id uuid;
  device_id uuid;
  household_id uuid;
  entity_id uuid;
  operation_type text;
  entity_type text;
  payload jsonb;
  local_sequence bigint;
  base_revision bigint;
  current_revision bigint;
  server_sequence bigint;
  command_hash bytea;
  applied_at timestamptz := clock_timestamp();
  receipt public.operation_receipts%rowtype;
  result jsonb;
  removed integer := 0;
begin
  if jsonb_typeof(command) <> 'object' then
    raise invalid_parameter_value using message = 'command must be an object';
  end if;
  if not public.mobile_json_is_uuid(command->'operationId')
     or not public.mobile_json_is_uuid(command->'householdId')
     or not public.mobile_json_is_uuid(command->'deviceId')
     or not public.mobile_json_is_uuid(command->'entityId')
  then
    raise invalid_parameter_value using message = 'command identifiers must be UUIDs';
  end if;
  if not public.mobile_json_is_integer(
    command->'localSequence', 0, 9007199254740991
  ) then
    raise invalid_parameter_value
      using message = 'localSequence must be a nonnegative safe integer';
  end if;
  if not (
    command->'baseRevision' = 'null'::jsonb
    or public.mobile_json_is_integer(
      command->'baseRevision', 1, 9007199254740991
    )
  ) then
    raise invalid_parameter_value
      using message = 'baseRevision must be null or a positive safe integer';
  end if;

  operation_id := (command->>'operationId')::uuid;
  household_id := (command->>'householdId')::uuid;
  device_id := (command->>'deviceId')::uuid;
  entity_id := (command->>'entityId')::uuid;
  local_sequence := (command->>'localSequence')::bigint;
  base_revision := case
    when command->'baseRevision' = 'null'::jsonb then null
    else (command->>'baseRevision')::bigint
  end;
  operation_type := command->>'type';
  entity_type := command->>'entityType';
  payload := command->'payload';

  actor_id := auth.uid();
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  perform 1 from public.households household
  where household.id = household_id
  for update;

  -- Hold the authorization row through commit. Membership is checked only
  -- after the household lock so removal cannot race this SECURITY DEFINER
  -- mutation after an earlier authorization read.
  perform 1
  from public.household_members member
  where member.household_id = household_id
    and member.user_id = actor_id
  for key share;
  if not found then
    raise insufficient_privilege
      using message = 'caller is not a member of the household';
  end if;

  command_hash := extensions.digest(command::text, 'sha256');

  select *
  into receipt
  from public.operation_receipts operation_receipt
  where operation_receipt.operation_id = operation_id;
  if found then
    if receipt.household_id <> household_id
       or receipt.command_hash <> command_hash then
      return public.mobile_rejected_result(
        operation_id,
        'operation_id_reused',
        'Operation ID was already used for a different command'
      );
    end if;
    if receipt.status = 'applied' then
      return jsonb_build_object(
        'status', 'duplicate',
        'operationId', operation_id,
        'serverSequence', receipt.server_sequence
      );
    end if;
    return receipt.result;
  end if;

  if not public.mobile_json_keys_valid(
    command,
    array[
      'schemaVersion','operationId','deviceId','localSequence','householdId',
      'type','entityType','entityId','baseRevision','enqueuedAt','payload'
    ]
  )
  or not public.mobile_json_is_integer(command->'schemaVersion', 1, 1)
  or jsonb_typeof(command->'enqueuedAt') <> 'string'
  or not public.mobile_is_iso_instant(command->>'enqueuedAt')
  then
    return public.mobile_store_rejection(
      household_id, actor_id, device_id, local_sequence, operation_id,
      command_hash, 'invalid_command', 'Command envelope is invalid'
    );
  end if;
  if operation_type not in ('notification.delete', 'notification.clear')
     or entity_type <> 'notification'
     or not public.mobile_operation_payload_valid(operation_type, payload)
  then
    return public.mobile_store_rejection(
      household_id, actor_id, device_id, local_sequence, operation_id,
      command_hash, 'invalid_payload', 'Notification operation is invalid'
    );
  end if;

  if operation_type = 'notification.delete' then
    select notification.revision
    into current_revision
    from public.notifications notification
    where notification.id = entity_id
      and notification.household_id = household_id
      and notification.recipient_user_id = actor_id
      and notification.kind in (
        'calendar.event.created',
        'calendar.event.updated',
        'calendar.event.deleted'
      )
    for update;
    if not found then
      return public.mobile_store_rejection(
        household_id, actor_id, device_id, local_sequence, operation_id,
        command_hash, 'notification_not_owned',
        'Only the recipient can remove visible Calendar activity'
      );
    end if;
    if base_revision is not null and base_revision <> current_revision then
      return public.mobile_store_rejection(
        household_id, actor_id, device_id, local_sequence, operation_id,
        command_hash, 'notification_stale',
        'The notification changed before it was removed',
        jsonb_build_object('currentRevision', current_revision)
      );
    end if;

    delete from public.notifications notification
    where notification.id = entity_id
      and notification.household_id = household_id;
    get diagnostics removed = row_count;
  else
    if entity_id <> actor_id or base_revision is not null then
      return public.mobile_store_rejection(
        household_id, actor_id, device_id, local_sequence, operation_id,
        command_hash, 'notification_clear_not_owned',
        'Clear all must target the signed-in recipient'
      );
    end if;
    delete from public.notifications notification
    where notification.household_id = household_id
      and notification.recipient_user_id = actor_id
      and notification.kind in (
        'calendar.event.created',
        'calendar.event.updated',
        'calendar.event.deleted'
      );
    get diagnostics removed = row_count;
  end if;

  select coalesce(max(operation_receipt.server_sequence), 0) + 1
  into server_sequence
  from public.operation_receipts operation_receipt
  where operation_receipt.household_id = household_id;

  result := jsonb_build_object(
    'status', 'applied',
    'operationId', operation_id,
    'serverSequence', server_sequence,
    'details', jsonb_build_object('removed', removed)
  );

  insert into public.operation_receipts (
    operation_id, household_id, actor_user_id, device_id, local_sequence,
    command_hash, server_sequence, status, result, created_at
  )
  values (
    operation_id, household_id, actor_id, device_id, local_sequence,
    command_hash, server_sequence, 'applied', result, applied_at
  );

  insert into public.household_change_log (
    household_id, server_sequence, operation_id, operation_type, entity_type,
    entity_id, entity_revision, change_kind, changed_at
  )
  values (
    household_id, server_sequence, operation_id, operation_type, entity_type,
    entity_id, coalesce(base_revision, 1),
    case when operation_type = 'notification.clear' then 'clear' else 'delete' end,
    applied_at
  );

  return result;
end;
$$;

alter function public.apply_household_operation(jsonb)
  rename to apply_household_operation_v3;

create function public.apply_household_operation(command jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if command->>'type' in ('notification.delete', 'notification.clear') then
    return public.mobile_apply_notification_removal(command);
  end if;
  return public.apply_household_operation_v3(command);
end;
$$;

-- Visible Calendar activity is retained indefinitely. Hidden reminder rows
-- and their cascading delivery records keep their TTL housekeeping.
create or replace function public.job_cleanup_read_notifications(
  ttl_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  cutoff timestamptz;
  removed integer;
begin
  if ttl_days is null or ttl_days < 1 then
    return public.mobile_admin_rejected(
      'invalid_ttl', 'The notification TTL must be at least one day.'
    );
  end if;

  cutoff := now() - make_interval(days => ttl_days);
  delete from public.notifications notification
  where notification.kind = 'calendar.reminder'
    and coalesce(notification.read_at, notification.created_at) < cutoff;
  get diagnostics removed = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object('removed', removed, 'cutoff', cutoff)
  );
end;
$$;

revoke execute on function public.mobile_snapshot_deleted_calendar_event()
  from public, anon, authenticated;
revoke execute on function public.mobile_expected_entity_type_v2(text)
  from public, anon, authenticated;
revoke execute on function public.mobile_operation_payload_valid_v2(text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.mobile_apply_notification_removal(jsonb)
  from public, anon, authenticated;
revoke execute on function public.apply_household_operation_v3(jsonb)
  from public, anon, authenticated;
revoke execute on function public.apply_household_operation(jsonb)
  from public, anon;
grant execute on function public.apply_household_operation(jsonb)
  to authenticated, service_role;
