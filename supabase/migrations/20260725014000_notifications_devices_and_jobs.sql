-- Task 3C: notification delivery surface and the server-side job contract the
-- Edge Functions drive.
--
-- Three groups of objects live here:
--
--   1. Device/delivery tables (`notification_devices`,
--      `calendar_reminder_dispatches`, `notification_push_deliveries`). Direct
--      client DML stays revoked, matching every other mobile-first table; the
--      only authenticated write path is the pair of device RPCs below.
--   2. Partner-only Calendar activity notifications, produced by a trigger on
--      `household_change_log` so every applied Calendar operation fans out
--      without touching the (already very large) operation RPC.
--   3. `job_*` functions, granted to `service_role` only. Edge Functions own
--      scheduling/date math and HTTP delivery; these functions own every write,
--      so each job step stays atomic and idempotent even if a function is
--      retried or invoked twice concurrently.

-- ---------------------------------------------------------------------------
-- Devices and delivery bookkeeping
-- ---------------------------------------------------------------------------

create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  expo_push_token text not null check (btrim(expo_push_token) <> ''),
  disabled_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_seen_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id),
  unique (expo_push_token)
);

-- One row per (event, preset, resolved start). Re-timing an event produces a new
-- occurrence_start, so the moved reminder fires again instead of being swallowed
-- by the old row.
create table public.calendar_reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  event_id uuid not null,
  preset text not null check (preset in ('at_time', '10m', '1h', '1d', '1w')),
  occurrence_start timestamptz not null,
  fire_at timestamptz not null,
  dispatched_at timestamptz not null default now(),
  foreign key (event_id, household_id)
    references public.calendar_events(id, household_id) on delete cascade,
  unique (event_id, preset, occurrence_start)
);

create table public.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  notification_id uuid not null,
  device_row_id uuid not null
    references public.notification_devices(id) on delete cascade,
  status text not null check (status in ('sent', 'skipped', 'failed')),
  expo_receipt_id text,
  error_code text,
  attempted_at timestamptz not null default now(),
  foreign key (notification_id, household_id)
    references public.notifications(id, household_id) on delete cascade,
  unique (notification_id, device_row_id)
);

create index notification_devices_household_idx
  on public.notification_devices(household_id, disabled_at);
create index calendar_reminder_dispatches_fire_idx
  on public.calendar_reminder_dispatches(household_id, fire_at desc);
create index notification_push_deliveries_notification_idx
  on public.notification_push_deliveries(notification_id);

alter table public.notification_devices enable row level security;
alter table public.calendar_reminder_dispatches enable row level security;
alter table public.notification_push_deliveries enable row level security;

-- A user may see only their own registered devices. Reminder dispatch and push
-- delivery rows are internal job bookkeeping: no client read policy at all.
create policy "own notification devices read"
  on public.notification_devices for select
  using (
    public.is_household_member(household_id)
    and user_id = auth.uid()
  );

revoke insert, update, delete, truncate on table
  public.notification_devices,
  public.calendar_reminder_dispatches,
  public.notification_push_deliveries
from authenticated, anon;

revoke select on table
  public.calendar_reminder_dispatches,
  public.notification_push_deliveries
from authenticated, anon;

grant select on table public.notification_devices to authenticated, service_role;

alter publication supabase_realtime add table public.notification_devices;
alter table public.notification_devices replica identity full;

-- ---------------------------------------------------------------------------
-- Membership cleanup: a removed member keeps their account but must stop
-- receiving this household's pushes, and their inbox rows become unreadable
-- under RLS anyway.
-- ---------------------------------------------------------------------------

create or replace function public.mobile_cleanup_removed_member()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.notification_devices
  where household_id = old.household_id
    and user_id = old.user_id;

  delete from public.notifications
  where household_id = old.household_id
    and recipient_user_id = old.user_id;

  return old;
end;
$$;

create trigger trg_household_members_cleanup_notifications
  after delete on public.household_members
  for each row execute function public.mobile_cleanup_removed_member();

-- ---------------------------------------------------------------------------
-- Authenticated device + preference RPCs
-- ---------------------------------------------------------------------------

create or replace function public.register_notification_device(
  target_device_id uuid,
  target_platform text,
  target_push_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  actor_household uuid;
  clean_token text := btrim(coalesce(target_push_token, ''));
  device_row_id uuid;
begin
  if actor is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  if target_device_id is null then
    return public.mobile_admin_rejected(
      'invalid_device', 'A device identifier is required.'
    );
  end if;
  if target_platform is null
     or target_platform not in ('ios', 'android', 'web') then
    return public.mobile_admin_rejected(
      'invalid_platform', 'Platform must be ios, android, or web.'
    );
  end if;
  if clean_token = '' or length(clean_token) > 256 then
    return public.mobile_admin_rejected(
      'invalid_push_token', 'A push token of 1-256 characters is required.'
    );
  end if;

  select household_id into actor_household
    from public.household_members where user_id = actor;
  if actor_household is null then
    return public.mobile_admin_rejected(
      'not_a_member', 'You are not a member of a household.'
    );
  end if;

  perform 1 from public.households where id = actor_household for update;

  -- Expo reissues a token to whichever install currently holds it. Release it
  -- from any other row first so the unique constraint cannot strand delivery on
  -- a stale device.
  delete from public.notification_devices
  where expo_push_token = clean_token
    and not (user_id = actor and device_id = target_device_id);

  insert into public.notification_devices (
    household_id, user_id, device_id, platform, expo_push_token
  )
  values (actor_household, actor, target_device_id, target_platform, clean_token)
  on conflict (user_id, device_id) do update
    set household_id = excluded.household_id,
        platform = excluded.platform,
        expo_push_token = excluded.expo_push_token,
        disabled_at = null,
        failure_count = 0,
        last_seen_at = now(),
        updated_at = now(),
        revision = notification_devices.revision + 1
  returning id into device_row_id;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object('deviceRowId', device_row_id)
  );
end;
$$;

create or replace function public.unregister_notification_device(
  target_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  affected integer;
begin
  if actor is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  delete from public.notification_devices
  where user_id = actor
    and device_id = target_device_id;
  get diagnostics affected = row_count;

  if affected = 0 then
    return public.mobile_admin_rejected(
      'device_not_found', 'That device is not registered.'
    );
  end if;

  return jsonb_build_object('status', 'ok', 'details', '{}'::jsonb);
end;
$$;

-- Appearance + notification preferences live on the global profile; profile DML
-- is revoked from clients, so this is their only write path.
create or replace function public.update_user_settings(
  target_appearance text,
  target_notifications_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  affected integer;
begin
  if actor is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  if target_appearance is null
     or target_appearance not in ('light', 'dark', 'system') then
    return public.mobile_admin_rejected(
      'invalid_appearance', 'Appearance must be light, dark, or system.'
    );
  end if;
  if target_notifications_enabled is null then
    return public.mobile_admin_rejected(
      'invalid_notification_preference',
      'A notification preference is required.'
    );
  end if;

  update public.profiles
    set appearance = target_appearance,
        notifications_enabled = target_notifications_enabled,
        updated_at = now(),
        revision = revision + 1
    where user_id = actor;
  get diagnostics affected = row_count;

  if affected = 0 then
    return public.mobile_admin_rejected(
      'profile_not_found', 'Complete onboarding before changing settings.'
    );
  end if;

  return jsonb_build_object('status', 'ok', 'details', '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Partner-only Calendar activity notifications
-- ---------------------------------------------------------------------------

-- Fires per applied operation. `household_change_log` is written last inside
-- apply_household_operation, after the receipt, so the actor is available.
-- Deleted events no longer have a title row to read; the payload still carries
-- entityId for the deep link.
create or replace function public.mobile_notify_calendar_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid;
  event_title text;
  activity_kind text;
begin
  if new.entity_type <> 'calendar_event' then
    return new;
  end if;

  select actor_user_id into actor
    from public.operation_receipts
    where operation_id = new.operation_id;
  if actor is null then
    return new;
  end if;

  select title into event_title
    from public.calendar_events
    where id = new.entity_id
      and household_id = new.household_id;

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
    jsonb_build_object(
      'title', to_jsonb(event_title),
      'operationId', new.operation_id,
      'serverSequence', new.server_sequence
    )
  from public.household_members member
  where member.household_id = new.household_id
    and member.user_id <> actor;

  return new;
end;
$$;

create trigger trg_household_change_log_calendar_activity
  after insert on public.household_change_log
  for each row execute function public.mobile_notify_calendar_activity();

-- ---------------------------------------------------------------------------
-- Job contract: Calendar reminder scheduling
-- ---------------------------------------------------------------------------

-- Candidate events for the scheduler: every event with at least one reminder
-- whose start falls in the requested window, plus the reminder presets and the
-- dispatch keys already recorded. The Edge Function resolves fire times (a
-- timezone-aware calculation it unit-tests) and calls the recorder below.
create or replace function public.job_calendar_reminder_candidates(
  window_start timestamptz,
  window_end timestamptz
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'householdId', candidate.household_id,
        'eventId', candidate.id,
        'title', candidate.title,
        'allDay', candidate.all_day,
        'startAt', candidate.start_at,
        'startDate', candidate.start_date,
        'eventTimezone', candidate.event_timezone,
        'presets', candidate.presets,
        'dispatched', candidate.dispatched
      )
      order by candidate.id
    ),
    '[]'::jsonb
  )
  from (
    select
      event.household_id,
      event.id,
      event.title,
      event.all_day,
      event.start_at,
      event.start_date,
      event.event_timezone,
      (
        select jsonb_agg(reminder.preset order by reminder.preset)
        from public.calendar_event_reminders reminder
        where reminder.event_id = event.id
      ) as presets,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'preset', dispatch.preset,
              'occurrenceStart', dispatch.occurrence_start
            )
            order by dispatch.preset, dispatch.occurrence_start
          )
          from public.calendar_reminder_dispatches dispatch
          where dispatch.event_id = event.id
        ),
        '[]'::jsonb
      ) as dispatched
    from public.calendar_events event
    where exists (
        select 1
        from public.calendar_event_reminders reminder
        where reminder.event_id = event.id
      )
      and coalesce(
        event.start_at,
        (event.start_date::timestamp at time zone event.event_timezone)
      ) between window_start and window_end
  ) candidate;
$$;

-- Records one reminder fan-out atomically. The unique dispatch key makes a
-- retried or concurrent scheduler run a no-op rather than a duplicate push.
-- Reminders go to every member (unlike activity notifications, which are
-- partner-only).
create or replace function public.job_record_calendar_reminder(
  target_household_id uuid,
  target_event_id uuid,
  target_preset text,
  target_occurrence_start timestamptz,
  target_fire_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  dispatch_id uuid;
  event_title text;
  created_count integer;
begin
  insert into public.calendar_reminder_dispatches (
    household_id, event_id, preset, occurrence_start, fire_at
  )
  values (
    target_household_id,
    target_event_id,
    target_preset,
    target_occurrence_start,
    target_fire_at
  )
  on conflict (event_id, preset, occurrence_start) do nothing
  returning id into dispatch_id;

  if dispatch_id is null then
    return jsonb_build_object(
      'status', 'ok',
      'details', jsonb_build_object('recorded', false, 'notifications', 0)
    );
  end if;

  select title into event_title
    from public.calendar_events
    where id = target_event_id
      and household_id = target_household_id;

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
    target_household_id,
    member.user_id,
    null,
    'calendar.reminder',
    'calendar_event',
    target_event_id,
    jsonb_build_object(
      'title', to_jsonb(event_title),
      'preset', target_preset,
      'occurrenceStart', target_occurrence_start
    )
  from public.household_members member
  where member.household_id = target_household_id;
  get diagnostics created_count = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object(
      'recorded', true,
      'dispatchId', dispatch_id,
      'notifications', created_count
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Job contract: push dispatch
-- ---------------------------------------------------------------------------

-- Notifications that still need a push attempt on at least one enabled device.
-- Recipients who turned notifications off are excluded from push while their
-- in-app inbox row is still created — the inbox is the durable record.
create or replace function public.job_pending_push_notifications(
  max_notifications integer default 100
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'notificationId', pending.id,
        'householdId', pending.household_id,
        'recipientUserId', pending.recipient_user_id,
        'kind', pending.kind,
        'entityType', pending.entity_type,
        'entityId', pending.entity_id,
        'payload', pending.payload,
        'devices', pending.devices
      )
      order by pending.created_at, pending.id
    ),
    '[]'::jsonb
  )
  from (
    select
      notification.id,
      notification.household_id,
      notification.recipient_user_id,
      notification.kind,
      notification.entity_type,
      notification.entity_id,
      notification.payload,
      notification.created_at,
      (
        select jsonb_agg(
          jsonb_build_object(
            'deviceRowId', device.id,
            'platform', device.platform,
            'expoPushToken', device.expo_push_token
          )
          order by device.id
        )
        from public.notification_devices device
        where device.user_id = notification.recipient_user_id
          and device.household_id = notification.household_id
          and device.disabled_at is null
          and not exists (
            select 1
            from public.notification_push_deliveries delivery
            where delivery.notification_id = notification.id
              and delivery.device_row_id = device.id
          )
      ) as devices
    from public.notifications notification
    join public.profiles profile
      on profile.user_id = notification.recipient_user_id
    where notification.read_at is null
      and profile.notifications_enabled
    order by notification.created_at, notification.id
    limit greatest(coalesce(max_notifications, 100), 1)
  ) pending
  where pending.devices is not null;
$$;

create or replace function public.job_record_push_delivery(
  target_notification_id uuid,
  target_device_row_id uuid,
  delivery_status text,
  receipt_id text default null,
  failure_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_household_id uuid;
begin
  if delivery_status not in ('sent', 'skipped', 'failed') then
    return public.mobile_admin_rejected(
      'invalid_status', 'Delivery status must be sent, skipped, or failed.'
    );
  end if;

  select household_id into target_household_id
    from public.notifications
    where id = target_notification_id;
  if target_household_id is null then
    return public.mobile_admin_rejected(
      'notification_not_found', 'That notification no longer exists.'
    );
  end if;

  insert into public.notification_push_deliveries (
    household_id,
    notification_id,
    device_row_id,
    status,
    expo_receipt_id,
    error_code
  )
  values (
    target_household_id,
    target_notification_id,
    target_device_row_id,
    delivery_status,
    receipt_id,
    failure_code
  )
  on conflict (notification_id, device_row_id) do update
    set status = excluded.status,
        expo_receipt_id = excluded.expo_receipt_id,
        error_code = excluded.error_code,
        attempted_at = now();

  if delivery_status = 'failed' then
    update public.notification_devices
      set failure_count = failure_count + 1,
          updated_at = now(),
          revision = revision + 1
      where id = target_device_row_id;
  end if;

  return jsonb_build_object('status', 'ok', 'details', '{}'::jsonb);
end;
$$;

-- Expo reports DeviceNotRegistered for uninstalled apps; the token is dead and
-- must stop consuming delivery attempts.
create or replace function public.job_disable_notification_device(
  target_device_row_id uuid,
  failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.notification_devices
    set disabled_at = coalesce(disabled_at, now()),
        failure_count = failure_count + 1,
        updated_at = now(),
        revision = revision + 1
    where id = target_device_row_id;

  if not found then
    return public.mobile_admin_rejected(
      'device_not_found', 'That device is not registered.'
    );
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object('errorCode', failure_code)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Job contract: recurring Asset transfers
-- ---------------------------------------------------------------------------

create or replace function public.job_active_transfer_schedules()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'scheduleId', schedule.id,
        'householdId', schedule.household_id,
        'fromAssetId', schedule.from_asset_id,
        'toAssetId', schedule.to_asset_id,
        'amountCents', schedule.amount_cents,
        'frequency', schedule.frequency,
        'startsAt', schedule.starts_at,
        'timezone', schedule.timezone,
        'lastOccurrenceDate', (
          select max(transfer.occurrence_date)
          from public.ledger_transfers transfer
          where transfer.schedule_id = schedule.id
        )
      )
      order by schedule.id
    ),
    '[]'::jsonb
  )
  from public.ledger_transfer_schedules schedule
  where schedule.active
    and not exists (
      select 1
      from public.household_tombstones tombstone
      where tombstone.household_id = schedule.household_id
        and tombstone.entity_type = 'ledger_transfer_schedule'
        and tombstone.entity_id = schedule.id
    );
$$;

-- Materializes one scheduled occurrence as a real transfer with balanced
-- postings, mirroring the ledger.transfer.upsert leg names. The partial unique
-- index on (schedule_id, occurrence_date) is the idempotency guarantee.
create or replace function public.job_execute_transfer_occurrence(
  target_schedule_id uuid,
  target_occurrence_date date,
  target_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  schedule public.ledger_transfer_schedules%rowtype;
  transfer_id uuid := gen_random_uuid();
  from_currency text;
  to_currency text;
  source_balance bigint;
  warnings jsonb := '[]'::jsonb;
begin
  select * into schedule
    from public.ledger_transfer_schedules
    where id = target_schedule_id;
  if schedule.id is null then
    return public.mobile_admin_rejected(
      'schedule_not_found', 'That transfer schedule no longer exists.'
    );
  end if;

  perform 1 from public.households where id = schedule.household_id for update;

  select * into schedule
    from public.ledger_transfer_schedules
    where id = target_schedule_id;
  if not schedule.active then
    return public.mobile_admin_rejected(
      'schedule_inactive', 'That transfer schedule is paused.'
    );
  end if;

  if exists (
    select 1
    from public.ledger_transfers
    where schedule_id = target_schedule_id
      and occurrence_date = target_occurrence_date
  ) then
    return jsonb_build_object(
      'status', 'ok',
      'details', jsonb_build_object('executed', false, 'reason', 'duplicate')
    );
  end if;

  select currency_code into from_currency
    from public.ledger_assets where id = schedule.from_asset_id;
  select currency_code into to_currency
    from public.ledger_assets where id = schedule.to_asset_id;
  if from_currency is null or to_currency is null or from_currency <> to_currency then
    return public.mobile_admin_rejected(
      'currency_mismatch',
      'Scheduled transfers require two Assets in the same currency.',
      jsonb_build_object('scheduleId', target_schedule_id)
    );
  end if;

  insert into public.ledger_transfers (
    id,
    household_id,
    from_asset_id,
    to_asset_id,
    amount_cents,
    occurred_at,
    note,
    schedule_id,
    occurrence_date,
    created_by
  )
  values (
    transfer_id,
    schedule.household_id,
    schedule.from_asset_id,
    schedule.to_asset_id,
    schedule.amount_cents,
    target_occurred_at,
    null,
    target_schedule_id,
    target_occurrence_date,
    schedule.created_by
  );

  perform public.mobile_add_posting(
    schedule.household_id, schedule.from_asset_id, transfer_id,
    'ledger_transfer', transfer_id, 'source',
    -schedule.amount_cents, target_occurred_at
  );
  perform public.mobile_add_posting(
    schedule.household_id, schedule.to_asset_id, transfer_id,
    'ledger_transfer', transfer_id, 'destination',
    schedule.amount_cents, target_occurred_at
  );

  insert into public.household_entity_revisions (
    household_id,
    entity_type,
    entity_id,
    revision,
    deleted,
    last_operation_id,
    winner_type,
    winner_entity_type,
    winner_entity_id,
    applied_at
  )
  values (
    schedule.household_id,
    'ledger_transfer',
    transfer_id,
    1,
    false,
    transfer_id,
    'ledger.transfer.scheduled',
    'ledger_transfer',
    transfer_id,
    target_occurred_at
  )
  on conflict on constraint household_entity_revisions_pkey do nothing;

  source_balance := public.mobile_asset_balance(schedule.from_asset_id);
  if source_balance < 0 then
    warnings := warnings || jsonb_build_array(
      jsonb_build_object(
        'code', 'negative_asset_balance',
        'assetId', schedule.from_asset_id,
        'balanceCents', source_balance
      )
    );
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object(
      'executed', true,
      'transferId', transfer_id,
      'occurrenceDate', target_occurrence_date,
      'warnings', warnings
    )
  );
exception
  when unique_violation then
    -- Concurrent run claimed the same occurrence.
    return jsonb_build_object(
      'status', 'ok',
      'details', jsonb_build_object('executed', false, 'reason', 'duplicate')
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Job contract: read-notification cleanup
-- ---------------------------------------------------------------------------

-- Read inbox items expire after the TTL. Unread items are kept indefinitely.
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

  delete from public.notifications
  where read_at is not null
    and read_at < cutoff;
  get diagnostics removed = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object(
      'removed', removed,
      'cutoff', cutoff
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------

-- Every household-scoped table records `created_by`/`recorded_by` with ON
-- DELETE RESTRICT (legacy page tables included), so an auth.users row cannot be
-- removed while any authored row still points at it. Reassigning authorship to
-- the surviving member preserves the household's data — which belongs to the
-- household, not the departing account.
create or replace function public.mobile_reassign_authorship(
  from_user_id uuid,
  to_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.pages set created_by = to_user_id where created_by = from_user_id;
  update public.budget_entries set created_by = to_user_id where created_by = from_user_id;
  update public.grocery_price_history set recorded_by = to_user_id where recorded_by = from_user_id;
  update public.savings_transactions set created_by = to_user_id where created_by = from_user_id;
  update public.calendar_events set created_by = to_user_id where created_by = from_user_id;

  update public.ledger_assets set created_by = to_user_id where created_by = from_user_id;
  update public.ledger_transfer_schedules set created_by = to_user_id where created_by = from_user_id;
  update public.ledger_transfers set created_by = to_user_id where created_by = from_user_id;
  update public.ledger_years set created_by = to_user_id where created_by = from_user_id;
  update public.ledger_categories set created_by = to_user_id where created_by = from_user_id;
  update public.ledger_transactions set created_by = to_user_id where created_by = from_user_id;
  update public.household_trips set created_by = to_user_id where created_by = from_user_id;
  update public.trip_expenses set created_by = to_user_id where created_by = from_user_id;
  update public.household_notes set created_by = to_user_id where created_by = from_user_id;
  update public.household_grocery_lists set created_by = to_user_id where created_by = from_user_id;
  update public.household_grocery_items set created_by = to_user_id where created_by = from_user_id;
  update public.household_grocery_price_history set recorded_by = to_user_id where recorded_by = from_user_id;
  update public.household_invites set created_by = to_user_id where created_by = from_user_id;
  update public.operation_receipts set actor_user_id = to_user_id where actor_user_id = from_user_id;
end;
$$;

-- Performs every database-side effect of deleting an account, then leaves the
-- Edge Function to remove the auth.users row (service-role only, not reachable
-- from SQL). Rules, per the approved design:
--
--   * an owner with a partner must transfer ownership or delete the household
--     first (rejected here);
--   * an owner who is the only member deletes the household as part of the
--     account deletion, so nothing is orphaned;
--   * a non-owner leaves the household, and their authored rows are reassigned
--     to the owner;
--   * a user with no household deletes only their own account.
create or replace function public.admin_prepare_account_deletion(
  target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_household uuid;
  target_role text;
  member_count integer;
  successor uuid;
begin
  if target_user_id is null then
    return public.mobile_admin_rejected(
      'invalid_target', 'A user identifier is required.'
    );
  end if;

  select household_id, member_role into target_household, target_role
    from public.household_members where user_id = target_user_id;

  if target_household is null then
    delete from public.profiles where user_id = target_user_id;
    return jsonb_build_object(
      'status', 'ok',
      'details', jsonb_build_object(
        'userId', target_user_id,
        'householdDeleted', false,
        'leftHousehold', false
      )
    );
  end if;

  perform 1 from public.households where id = target_household for update;

  select count(*) into member_count
    from public.household_members where household_id = target_household;

  if target_role = 'owner' and member_count > 1 then
    return public.mobile_admin_rejected(
      'must_transfer_ownership',
      'Transfer ownership or delete the household before deleting your account.',
      jsonb_build_object('householdId', target_household)
    );
  end if;

  if target_role = 'owner' then
    delete from public.households where id = target_household;
    delete from public.profiles where user_id = target_user_id;
    return jsonb_build_object(
      'status', 'ok',
      'details', jsonb_build_object(
        'userId', target_user_id,
        'householdDeleted', true,
        'leftHousehold', true,
        'householdId', target_household
      )
    );
  end if;

  select user_id into successor
    from public.household_members
    where household_id = target_household
      and user_id <> target_user_id
      and member_role = 'owner';
  if successor is null then
    return public.mobile_admin_rejected(
      'no_successor',
      'This household has no owner to inherit the departing member’s entries.',
      jsonb_build_object('householdId', target_household)
    );
  end if;

  delete from public.household_members
    where household_id = target_household
      and user_id = target_user_id;
  perform public.mobile_reassign_authorship(target_user_id, successor);
  delete from public.profiles where user_id = target_user_id;

  return jsonb_build_object(
    'status', 'ok',
    'details', jsonb_build_object(
      'userId', target_user_id,
      'householdDeleted', false,
      'leftHousehold', true,
      'householdId', target_household,
      'successorUserId', successor
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.mobile_cleanup_removed_member()
  from public, anon, authenticated;
revoke execute on function public.mobile_notify_calendar_activity()
  from public, anon, authenticated;
revoke execute on function public.mobile_reassign_authorship(uuid, uuid)
  from public, anon, authenticated;

revoke execute on function public.register_notification_device(uuid, text, text)
  from public, anon;
revoke execute on function public.unregister_notification_device(uuid)
  from public, anon;
revoke execute on function public.update_user_settings(text, boolean)
  from public, anon;

grant execute on function public.register_notification_device(uuid, text, text)
  to authenticated;
grant execute on function public.unregister_notification_device(uuid)
  to authenticated;
grant execute on function public.update_user_settings(text, boolean)
  to authenticated;

-- Job entry points are reachable only by the service-role Edge Functions.
revoke execute on function public.job_calendar_reminder_candidates(
  timestamptz, timestamptz
) from public, anon, authenticated;
revoke execute on function public.job_record_calendar_reminder(
  uuid, uuid, text, timestamptz, timestamptz
) from public, anon, authenticated;
revoke execute on function public.job_pending_push_notifications(integer)
  from public, anon, authenticated;
revoke execute on function public.job_record_push_delivery(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
revoke execute on function public.job_disable_notification_device(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.job_active_transfer_schedules()
  from public, anon, authenticated;
revoke execute on function public.job_execute_transfer_occurrence(
  uuid, date, timestamptz
) from public, anon, authenticated;
revoke execute on function public.job_cleanup_read_notifications(integer)
  from public, anon, authenticated;
revoke execute on function public.admin_prepare_account_deletion(uuid)
  from public, anon, authenticated;

grant execute on function public.job_calendar_reminder_candidates(
  timestamptz, timestamptz
) to service_role;
grant execute on function public.job_record_calendar_reminder(
  uuid, uuid, text, timestamptz, timestamptz
) to service_role;
grant execute on function public.job_pending_push_notifications(integer)
  to service_role;
grant execute on function public.job_record_push_delivery(
  uuid, uuid, text, text, text
) to service_role;
grant execute on function public.job_disable_notification_device(uuid, text)
  to service_role;
grant execute on function public.job_active_transfer_schedules()
  to service_role;
grant execute on function public.job_execute_transfer_occurrence(
  uuid, date, timestamptz
) to service_role;
grant execute on function public.job_cleanup_read_notifications(integer)
  to service_role;
grant execute on function public.admin_prepare_account_deletion(uuid)
  to service_role;
