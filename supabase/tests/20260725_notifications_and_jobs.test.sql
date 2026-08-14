begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
set local timezone = 'UTC';

select no_plan();

-- Two members in one household plus an outsider, so partner-only fan-out and
-- tenant scoping are both observable.
insert into auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated',
   'notify-a@example.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000d2', 'authenticated', 'authenticated',
   'notify-b@example.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-0000000000d3', 'authenticated', 'authenticated',
   'notify-c@example.test', '', now(), now(), now());

insert into public.households (id, name, owner_user_id)
values (
  '10000000-0000-4000-8000-0000000000d1',
  'Notification household',
  '00000000-0000-4000-8000-0000000000d1'
);

insert into public.household_members (
  id, household_id, user_id, display_name, member_role
)
values
  ('11000000-0000-4000-8000-0000000000d1',
   '10000000-0000-4000-8000-0000000000d1',
   '00000000-0000-4000-8000-0000000000d1', 'Ann', 'owner'),
  ('11000000-0000-4000-8000-0000000000d2',
   '10000000-0000-4000-8000-0000000000d1',
   '00000000-0000-4000-8000-0000000000d2', 'Ben', 'member');

insert into public.profiles (user_id, display_name)
values
  ('00000000-0000-4000-8000-0000000000d1', 'Ann'),
  ('00000000-0000-4000-8000-0000000000d2', 'Ben');

create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, true);
$$;

create function pg_temp.operation_command(
  operation_id uuid,
  operation_type text,
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
    'householdId', '10000000-0000-4000-8000-0000000000d1',
    'type', operation_type,
    'entityType', 'calendar_event',
    'entityId', entity_id,
    'baseRevision', base_revision,
    'enqueuedAt', '2026-07-24T20:00:00.000Z',
    'payload', payload
  );
$$;

create function pg_temp.notification_command(
  operation_id uuid,
  operation_type text,
  entity_id uuid,
  base_revision bigint,
  local_sequence bigint
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'operationId', operation_id,
    'deviceId', '20000000-0000-4000-8000-0000000000d2',
    'localSequence', local_sequence,
    'householdId', '10000000-0000-4000-8000-0000000000d1',
    'type', operation_type,
    'entityType', 'notification',
    'entityId', entity_id,
    'baseRevision', base_revision,
    'enqueuedAt', '2026-08-13T20:00:00.000Z',
    'payload', '{}'::jsonb
  );
$$;

-- --- Schema, RLS, and privilege floor ---------------------------------------
select has_table('public', 'notification_devices', 'device registry exists');
select has_table(
  'public', 'calendar_reminder_dispatches', 'reminder dispatch ledger exists'
);
select has_table(
  'public', 'notification_push_deliveries', 'push delivery ledger exists'
);

select is(
  (select count(*)::int
   from pg_class
   where relname in (
       'notification_devices',
       'calendar_reminder_dispatches',
       'notification_push_deliveries'
     )
     and relnamespace = 'public'::regnamespace
     and relrowsecurity),
  3,
  'every new delivery table has row level security enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.notification_devices', 'INSERT')
  and not has_table_privilege('authenticated', 'public.notification_devices', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.notification_devices', 'DELETE'),
  'clients cannot write the device registry directly'
);
select ok(
  has_table_privilege('authenticated', 'public.notification_devices', 'SELECT'),
  'clients may read their own device rows through RLS'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.calendar_reminder_dispatches', 'SELECT'
  )
  and not has_table_privilege(
    'authenticated', 'public.notification_push_deliveries', 'SELECT'
  ),
  'job bookkeeping tables are not client-readable'
);

-- --- Device registration -----------------------------------------------------
select pg_temp.act_as('');
select throws_ok(
  $$ select public.register_notification_device(
       '21000000-0000-4000-8000-0000000000d1', 'ios', 'ExponentPushToken[a]'
     ) $$,
  '42501',
  null,
  'device registration requires authentication'
);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d3');
select is(
  (public.register_notification_device(
    '21000000-0000-4000-8000-0000000000d9', 'ios', 'ExponentPushToken[zz]'
  ))->>'code',
  'not_a_member',
  'a user without a household cannot register a device'
);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
select is(
  (public.register_notification_device(
    '21000000-0000-4000-8000-0000000000d1', 'symbian', 'ExponentPushToken[a]'
  ))->>'code',
  'invalid_platform',
  'an unsupported platform is rejected'
);
select is(
  (public.register_notification_device(
    '21000000-0000-4000-8000-0000000000d1', 'ios', '   '
  ))->>'code',
  'invalid_push_token',
  'a blank push token is rejected'
);
select is(
  (public.register_notification_device(
    '21000000-0000-4000-8000-0000000000d1', 'ios', 'ExponentPushToken[a]'
  ))->>'status',
  'ok',
  'a member registers a device'
);
select is(
  (select platform from public.notification_devices
     where user_id = '00000000-0000-4000-8000-0000000000d1'),
  'ios',
  'the device row records the platform'
);

-- re-registering the same install rotates the token in place
select is(
  (public.register_notification_device(
    '21000000-0000-4000-8000-0000000000d1', 'ios', 'ExponentPushToken[a2]'
  ))->>'status',
  'ok',
  're-registering the same device succeeds'
);
select is(
  (select count(*)::int from public.notification_devices
     where user_id = '00000000-0000-4000-8000-0000000000d1'),
  1,
  're-registration updates the existing row rather than adding one'
);
select is(
  (select expo_push_token from public.notification_devices
     where user_id = '00000000-0000-4000-8000-0000000000d1'),
  'ExponentPushToken[a2]',
  'the rotated push token is stored'
);
select is(
  (select revision from public.notification_devices
     where user_id = '00000000-0000-4000-8000-0000000000d1'),
  2::bigint,
  're-registration advances the device revision'
);

-- Ben registers, then Expo hands Ben's token to Ann's second install: the token
-- must follow the live install, never stay bound to the stale one.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
select is(
  (public.register_notification_device(
    '21000000-0000-4000-8000-0000000000d2', 'android', 'ExponentPushToken[b]'
  ))->>'status',
  'ok',
  'the partner registers their own device'
);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
select is(
  (public.register_notification_device(
    '21000000-0000-4000-8000-0000000000d3', 'web', 'ExponentPushToken[b]'
  ))->>'status',
  'ok',
  'a reissued push token can be claimed by another install'
);
select is(
  (select count(*)::int from public.notification_devices
     where expo_push_token = 'ExponentPushToken[b]'),
  1,
  'the reissued token exists on exactly one device row'
);
select is(
  (select user_id::text from public.notification_devices
     where expo_push_token = 'ExponentPushToken[b]'),
  '00000000-0000-4000-8000-0000000000d1',
  'the reissued token now belongs to the claiming install'
);

select is(
  (public.unregister_notification_device(
    '21000000-0000-4000-8000-0000000000d3'
  ))->>'status',
  'ok',
  'a member unregisters their own device'
);
select is(
  (public.unregister_notification_device(
    '21000000-0000-4000-8000-0000000000d3'
  ))->>'code',
  'device_not_found',
  'unregistering an unknown device is rejected'
);

-- --- Appearance and notification preferences ---------------------------------
select is(
  (public.update_user_settings('midnight', true))->>'code',
  'invalid_appearance',
  'an unsupported appearance is rejected'
);
select is(
  (public.update_user_settings('dark', false))->>'status',
  'ok',
  'a member updates appearance and notification preferences'
);
select is(
  (select appearance || ':' || notifications_enabled::text
     from public.profiles where user_id = '00000000-0000-4000-8000-0000000000d1'),
  'dark:false',
  'the profile stores the new settings'
);
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d3');
select is(
  (public.update_user_settings('dark', true))->>'code',
  'profile_not_found',
  'a user without a profile cannot store settings'
);

-- restore Ann's push preference for the dispatch assertions below
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
select is(
  (public.update_user_settings('system', true))->>'status', 'ok',
  'notification preferences can be turned back on'
);

-- --- Partner-only Calendar activity notifications ----------------------------
select is(
  (public.apply_household_operation(pg_temp.operation_command(
    '40000000-0000-4000-8000-0000000000d1',
    'calendar.event.upsert',
    '31000000-0000-4000-8000-0000000000d1',
    null,
    jsonb_build_object(
      'title', 'Dentist',
      'note', null,
      'ownerId', null,
      'allDay', false,
      'startAt', '2026-08-05T14:00:00.000Z',
      'endAt', '2026-08-05T15:00:00.000Z',
      'timezone', 'America/Toronto',
      'recurrenceFrequency', 'none',
      'recurrenceUntil', null,
      'reminders', jsonb_build_array('at_time', '1d')
    ),
    1
  )))->>'status',
  'applied',
  'a Calendar event is created through the operation RPC'
);

select is(
  (select count(*)::int from public.notifications
     where entity_id = '31000000-0000-4000-8000-0000000000d1'
       and recipient_user_id = '00000000-0000-4000-8000-0000000000d2'
       and kind = 'calendar.event.created'),
  1,
  'the partner receives one create notification'
);
select is(
  (select count(*)::int from public.notifications
     where entity_id = '31000000-0000-4000-8000-0000000000d1'
       and recipient_user_id = '00000000-0000-4000-8000-0000000000d1'),
  0,
  'the acting member never notifies themselves'
);
select is(
  (select payload->>'title' from public.notifications
     where entity_id = '31000000-0000-4000-8000-0000000000d1'
       and kind = 'calendar.event.created'),
  'Dentist',
  'the activity payload carries the event title for the inbox row'
);
select is(
  (select payload->>'actorName' from public.notifications
     where entity_id = '31000000-0000-4000-8000-0000000000d1'
       and kind = 'calendar.event.created'),
  'Ann',
  'the activity payload snapshots the actor display name'
);
select is(
  (select payload->>'startAt' from public.notifications
     where entity_id = '31000000-0000-4000-8000-0000000000d1'
       and kind = 'calendar.event.created'),
  '2026-08-05T14:00:00+00:00',
  'the activity payload snapshots the event start instant'
);
select is(
  (select payload->>'timezone' from public.notifications
     where entity_id = '31000000-0000-4000-8000-0000000000d1'
       and kind = 'calendar.event.created'),
  'America/Toronto',
  'the activity payload snapshots the event timezone'
);

select is(
  (public.apply_household_operation(pg_temp.operation_command(
    '40000000-0000-4000-8000-0000000000d2',
    'calendar.event.upsert',
    '31000000-0000-4000-8000-0000000000d1',
    1,
    jsonb_build_object(
      'title', 'Dentist (moved)',
      'note', null,
      'ownerId', null,
      'allDay', false,
      'startAt', '2026-08-06T14:00:00.000Z',
      'endAt', '2026-08-06T15:00:00.000Z',
      'timezone', 'America/Toronto',
      'recurrenceFrequency', 'none',
      'recurrenceUntil', null,
      'reminders', jsonb_build_array('at_time', '1d')
    ),
    2
  )))->>'status',
  'applied',
  'the Calendar event is edited'
);
select is(
  (select count(*)::int from public.notifications
     where entity_id = '31000000-0000-4000-8000-0000000000d1'
       and kind = 'calendar.event.updated'),
  1,
  'an edit produces an update notification, not a second create'
);

select is(
  (public.apply_household_operation(pg_temp.operation_command(
    '40000000-0000-4000-8000-0000000000d3',
    'calendar.event.upsert',
    '31000000-0000-4000-8000-0000000000d2',
    null,
    jsonb_build_object(
      'title', 'Dinner',
      'note', null,
      'ownerId', null,
      'allDay', false,
      'startAt', '2026-08-07T18:00:00.000Z',
      'endAt', '2026-08-07T19:00:00.000Z',
      'timezone', 'America/Vancouver',
      'recurrenceFrequency', 'none',
      'recurrenceUntil', null,
      'reminders', jsonb_build_array()
    ),
    3
  )))->>'status',
  'applied',
  'a second Calendar event is created for deletion snapshot coverage'
);
select is(
  (public.apply_household_operation(pg_temp.operation_command(
    '40000000-0000-4000-8000-0000000000d4',
    'calendar.event.delete',
    '31000000-0000-4000-8000-0000000000d2',
    1,
    '{}'::jsonb,
    4
  )))->>'status',
  'applied',
  'the second Calendar event is deleted'
);
select is(
  (select payload->>'title' from public.notifications
     where entity_id = '31000000-0000-4000-8000-0000000000d2'
       and kind = 'calendar.event.deleted'),
  'Dinner',
  'deleted activity retains the event title snapshot'
);
select is(
  (select payload->>'startAt' from public.notifications
     where entity_id = '31000000-0000-4000-8000-0000000000d2'
       and kind = 'calendar.event.deleted'),
  '2026-08-07T18:00:00+00:00',
  'deleted activity retains the event time snapshot'
);
select ok(
  (select payload ? 'deletedAt' from public.notifications
     where entity_id = '31000000-0000-4000-8000-0000000000d2'
       and kind = 'calendar.event.deleted'),
  'deleted activity snapshots deletion details'
);

-- --- Durable Schedule activity removal --------------------------------------
select set_config(
  'tests.activity_notification',
  (select id::text from public.notifications
     where recipient_user_id = '00000000-0000-4000-8000-0000000000d2'
       and kind = 'calendar.event.updated'
     limit 1),
  true
);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
select is(
  (public.apply_household_operation(pg_temp.notification_command(
    '40000000-0000-4000-8000-0000000000d5',
    'notification.delete',
    current_setting('tests.activity_notification')::uuid,
    1,
    5
  )))->>'code',
  'notification_not_owned',
  'a member cannot remove another recipient activity row'
);

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
select is(
  (public.apply_household_operation(pg_temp.notification_command(
    '40000000-0000-4000-8000-0000000000d6',
    'notification.delete',
    current_setting('tests.activity_notification')::uuid,
    1,
    6
  )))->>'status',
  'applied',
  'a recipient can durably remove one activity row'
);
select is(
  (public.apply_household_operation(pg_temp.notification_command(
    '40000000-0000-4000-8000-0000000000d6',
    'notification.delete',
    current_setting('tests.activity_notification')::uuid,
    1,
    6
  )))->>'status',
  'duplicate',
  'notification removal replay is idempotent'
);

insert into public.notifications (
  id, household_id, recipient_user_id, kind, entity_type, entity_id, payload
)
values (
  '39000000-0000-4000-8000-0000000000d9',
  '10000000-0000-4000-8000-0000000000d1',
  '00000000-0000-4000-8000-0000000000d2',
  'calendar.reminder',
  'calendar_event',
  '31000000-0000-4000-8000-0000000000d1',
  '{}'::jsonb
);
select is(
  (public.apply_household_operation(pg_temp.notification_command(
    '40000000-0000-4000-8000-0000000000d7',
    'notification.clear',
    '00000000-0000-4000-8000-0000000000d2',
    null,
    7
  )))->>'status',
  'applied',
  'Clear all is a durable recipient-scoped operation'
);
select is(
  (select count(*)::int from public.notifications
     where recipient_user_id = '00000000-0000-4000-8000-0000000000d2'
       and kind in (
         'calendar.event.created',
         'calendar.event.updated',
         'calendar.event.deleted'
       )),
  0,
  'Clear all removes every visible Schedule activity row'
);
select is(
  (select count(*)::int from public.notifications
     where id = '39000000-0000-4000-8000-0000000000d9'),
  1,
  'Clear all preserves hidden push-only reminder rows'
);
delete from public.notifications
where id = '39000000-0000-4000-8000-0000000000d9';

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');

-- --- Reminder scheduling contract -------------------------------------------
select set_config(
  'tests.candidates',
  (public.job_calendar_reminder_candidates(
    '2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z'
  ))::text,
  true
);
select is(
  jsonb_array_length(current_setting('tests.candidates')::jsonb),
  1,
  'the scheduler sees exactly the one event carrying reminders'
);
select is(
  current_setting('tests.candidates')::jsonb->0->'presets',
  '["1d","at_time"]'::jsonb,
  'candidate events expose their reminder presets'
);
select is(
  current_setting('tests.candidates')::jsonb->0->'dispatched',
  '[]'::jsonb,
  'nothing is recorded as dispatched before the first run'
);
select is(
  jsonb_array_length(
    public.job_calendar_reminder_candidates(
      '2027-01-01T00:00:00Z', '2027-02-01T00:00:00Z'
    )
  ),
  0,
  'events outside the requested window are not candidates'
);

select set_config(
  'tests.reminder',
  (public.job_record_calendar_reminder(
    '10000000-0000-4000-8000-0000000000d1',
    '31000000-0000-4000-8000-0000000000d1',
    'at_time',
    '2026-08-06T14:00:00Z',
    '2026-08-06T14:00:00Z'
  ))::text,
  true
);
select is(
  current_setting('tests.reminder')::jsonb->'details'->>'recorded',
  'true',
  'the first reminder dispatch is recorded'
);
select is(
  (current_setting('tests.reminder')::jsonb->'details'->>'notifications')::int,
  2,
  'a reminder notifies every household member, not only the partner'
);
select is(
  (public.job_record_calendar_reminder(
    '10000000-0000-4000-8000-0000000000d1',
    '31000000-0000-4000-8000-0000000000d1',
    'at_time',
    '2026-08-06T14:00:00Z',
    '2026-08-06T14:00:00Z'
  ))->'details'->>'recorded',
  'false',
  'a repeated scheduler run does not re-send the same reminder'
);
select is(
  (select count(*)::int from public.notifications where kind = 'calendar.reminder'),
  2,
  'the duplicate run created no additional inbox rows'
);
select is(
  (public.job_record_calendar_reminder(
    '10000000-0000-4000-8000-0000000000d1',
    '31000000-0000-4000-8000-0000000000d1',
    'at_time',
    '2026-08-07T14:00:00Z',
    '2026-08-07T14:00:00Z'
  ))->'details'->>'recorded',
  'true',
  'a re-timed event fires its reminder again at the new start'
);

-- --- Push dispatch contract --------------------------------------------------
delete from public.notifications where kind <> 'calendar.reminder';
delete from public.notifications
where recipient_user_id = '00000000-0000-4000-8000-0000000000d2';

select set_config(
  'tests.pending',
  (public.job_pending_push_notifications(100))::text,
  true
);
select is(
  jsonb_array_length(current_setting('tests.pending')::jsonb),
  2,
  'both undelivered reminders for the registered device are pending'
);
select is(
  jsonb_array_length(current_setting('tests.pending')::jsonb->0->'devices'),
  1,
  'each pending notification lists the recipient enabled devices'
);
select is(
  current_setting('tests.pending')::jsonb->0->'devices'->0->>'expoPushToken',
  'ExponentPushToken[a2]',
  'the pending payload carries the live push token'
);

select set_config(
  'tests.device',
  (select id::text from public.notification_devices
     where user_id = '00000000-0000-4000-8000-0000000000d1'),
  true
);
select set_config(
  'tests.notification',
  (current_setting('tests.pending')::jsonb->0->>'notificationId'),
  true
);

select is(
  (public.job_record_push_delivery(
    current_setting('tests.notification')::uuid,
    current_setting('tests.device')::uuid,
    'sent',
    'receipt-1',
    null
  ))->>'status',
  'ok',
  'a successful push delivery is recorded'
);
select is(
  jsonb_array_length(public.job_pending_push_notifications(100)),
  1,
  'a delivered notification stops being pending for that device'
);
select is(
  (public.job_record_push_delivery(
    current_setting('tests.notification')::uuid,
    current_setting('tests.device')::uuid,
    'teleported',
    null,
    null
  ))->>'code',
  'invalid_status',
  'an unknown delivery status is rejected'
);
select is(
  (public.job_record_push_delivery(
    '39000000-0000-4000-8000-00000000dead',
    current_setting('tests.device')::uuid,
    'sent',
    null,
    null
  ))->>'code',
  'notification_not_found',
  'delivery cannot be recorded against a vanished notification'
);

select is(
  (public.job_disable_notification_device(
    current_setting('tests.device')::uuid, 'DeviceNotRegistered'
  ))->>'status',
  'ok',
  'an unregistered Expo token disables its device row'
);
select is(
  jsonb_array_length(public.job_pending_push_notifications(100)),
  0,
  'a disabled device receives no further push attempts'
);
select is(
  (public.job_disable_notification_device(
    '29000000-0000-4000-8000-00000000dead', 'DeviceNotRegistered'
  ))->>'code',
  'device_not_found',
  'disabling an unknown device is rejected'
);

-- notifications the recipient opted out of never reach push
update public.notification_devices set disabled_at = null
  where id = current_setting('tests.device')::uuid;
update public.profiles set notifications_enabled = false
  where user_id = '00000000-0000-4000-8000-0000000000d1';
select is(
  jsonb_array_length(public.job_pending_push_notifications(100)),
  0,
  'a recipient who disabled notifications is skipped for push'
);
update public.profiles set notifications_enabled = true
  where user_id = '00000000-0000-4000-8000-0000000000d1';

-- --- Read-notification cleanup ----------------------------------------------
insert into public.notifications (
  id, household_id, recipient_user_id, actor_user_id, kind,
  entity_type, entity_id, payload, read_at, created_at
)
values
  (
    '39000000-0000-4000-8000-0000000000da',
    '10000000-0000-4000-8000-0000000000d1',
    '00000000-0000-4000-8000-0000000000d1',
    '00000000-0000-4000-8000-0000000000d2',
    'calendar.event.updated', 'calendar_event',
    '31000000-0000-4000-8000-0000000000d1', '{}'::jsonb,
    now() - interval '120 days', now() - interval '120 days'
  ),
  (
    '39000000-0000-4000-8000-0000000000db',
    '10000000-0000-4000-8000-0000000000d1',
    '00000000-0000-4000-8000-0000000000d1',
    '00000000-0000-4000-8000-0000000000d2',
    'calendar.event.created', 'calendar_event',
    '31000000-0000-4000-8000-0000000000d1', '{}'::jsonb,
    null, now() - interval '120 days'
  );
update public.notifications
  set read_at = now() - interval '120 days'
  where id = current_setting('tests.notification')::uuid;

select is(
  (public.job_cleanup_read_notifications(0))->>'code',
  'invalid_ttl',
  'a non-positive TTL is rejected'
);
select is(
  (public.job_cleanup_read_notifications(90))->'details'->>'removed',
  '1',
  'a read notification older than the TTL is purged'
);
select is(
  (select count(*)::int from public.notifications
     where id = current_setting('tests.notification')::uuid),
  0,
  'the expired inbox row is gone'
);
select ok(
  (select count(*) = 2 from public.notifications
     where id in (
       '39000000-0000-4000-8000-0000000000da',
       '39000000-0000-4000-8000-0000000000db'
     )),
  'read and unread visible Calendar activity survive cleanup regardless of age'
);

-- --- Recurring Asset transfers ----------------------------------------------
insert into public.ledger_assets (
  id, household_id, name, kind, currency_code, created_by
)
values
  ('50000000-0000-4000-8000-0000000000d1',
   '10000000-0000-4000-8000-0000000000d1', 'Chequing', 'checking', 'CAD',
   '00000000-0000-4000-8000-0000000000d1'),
  ('50000000-0000-4000-8000-0000000000d2',
   '10000000-0000-4000-8000-0000000000d1', 'Savings', 'savings', 'CAD',
   '00000000-0000-4000-8000-0000000000d1'),
  ('50000000-0000-4000-8000-0000000000d3',
   '10000000-0000-4000-8000-0000000000d1', 'GBP cash', 'cash', 'GBP',
   '00000000-0000-4000-8000-0000000000d1');

insert into public.ledger_transfer_schedules (
  id, household_id, from_asset_id, to_asset_id, amount_cents,
  frequency, starts_at, timezone, created_by
)
values
  ('51000000-0000-4000-8000-0000000000d1',
   '10000000-0000-4000-8000-0000000000d1',
   '50000000-0000-4000-8000-0000000000d1',
   '50000000-0000-4000-8000-0000000000d2',
   25000, 'monthly', '2026-01-05T13:00:00Z', 'America/Toronto',
   '00000000-0000-4000-8000-0000000000d1'),
  ('51000000-0000-4000-8000-0000000000d2',
   '10000000-0000-4000-8000-0000000000d1',
   '50000000-0000-4000-8000-0000000000d1',
   '50000000-0000-4000-8000-0000000000d3',
   1000, 'weekly', '2026-01-05T13:00:00Z', 'America/Toronto',
   '00000000-0000-4000-8000-0000000000d1'),
  ('51000000-0000-4000-8000-0000000000d3',
   '10000000-0000-4000-8000-0000000000d1',
   '50000000-0000-4000-8000-0000000000d1',
   '50000000-0000-4000-8000-0000000000d2',
   500, 'weekly', '2026-01-05T13:00:00Z', 'America/Toronto',
   '00000000-0000-4000-8000-0000000000d1');

update public.ledger_transfer_schedules set active = false
  where id = '51000000-0000-4000-8000-0000000000d3';

select is(
  jsonb_array_length(public.job_active_transfer_schedules()),
  2,
  'only active schedules are handed to the executor'
);
select is(
  (select schedule->>'lastOccurrenceDate'
     from jsonb_array_elements(public.job_active_transfer_schedules()) schedule
     where schedule->>'scheduleId' = '51000000-0000-4000-8000-0000000000d1'),
  null,
  'a schedule with no executions reports no last occurrence'
);

select is(
  (public.job_execute_transfer_occurrence(
    '51000000-0000-4000-8000-0000000000d1',
    '2026-02-05',
    '2026-02-05T18:00:00Z'
  ))->'details'->>'executed',
  'true',
  'a due occurrence materializes a transfer'
);
select is(
  (select amount_cents from public.ledger_transfers
     where schedule_id = '51000000-0000-4000-8000-0000000000d1'
       and occurrence_date = '2026-02-05'),
  25000::bigint,
  'the generated transfer carries the scheduled amount'
);
select is(
  (select sum(amount_cents)::bigint from public.asset_postings
     where effect_type = 'ledger_transfer'
       and effect_id = (select id from public.ledger_transfers
                          where schedule_id = '51000000-0000-4000-8000-0000000000d1')),
  0::bigint,
  'the scheduled transfer postings balance to zero'
);
select is(
  (select count(*)::int from public.asset_postings
     where asset_id = '50000000-0000-4000-8000-0000000000d2'
       and amount_cents = 25000),
  1,
  'the destination Asset is credited once'
);
select is(
  (select revision from public.household_entity_revisions
     where entity_type = 'ledger_transfer'
       and entity_id = (select id from public.ledger_transfers
                          where schedule_id = '51000000-0000-4000-8000-0000000000d1')),
  1::bigint,
  'the generated transfer joins the entity revision registry'
);
select is(
  (public.job_execute_transfer_occurrence(
    '51000000-0000-4000-8000-0000000000d1',
    '2026-02-05',
    '2026-02-05T18:00:00Z'
  ))->'details'->>'reason',
  'duplicate',
  'a replayed occurrence is idempotent'
);
select is(
  (select count(*)::int from public.ledger_transfers
     where schedule_id = '51000000-0000-4000-8000-0000000000d1'),
  1,
  'the replay created no second transfer'
);
select ok(
  (public.job_execute_transfer_occurrence(
    '51000000-0000-4000-8000-0000000000d1',
    '2026-03-05',
    '2026-03-05T18:00:00Z'
  ))->'details'->'warnings' <> '[]'::jsonb,
  'driving the source Asset below zero returns a warning without blocking'
);
select is(
  (select schedule->>'lastOccurrenceDate'
     from jsonb_array_elements(public.job_active_transfer_schedules()) schedule
     where schedule->>'scheduleId' = '51000000-0000-4000-8000-0000000000d1'),
  '2026-03-05',
  'the executor reports the latest materialized occurrence'
);
select is(
  (public.job_execute_transfer_occurrence(
    '51000000-0000-4000-8000-0000000000d2',
    '2026-02-05',
    '2026-02-05T18:00:00Z'
  ))->>'code',
  'currency_mismatch',
  'a cross-currency schedule cannot execute'
);
select is(
  (public.job_execute_transfer_occurrence(
    '51000000-0000-4000-8000-0000000000d3',
    '2026-02-05',
    '2026-02-05T18:00:00Z'
  ))->>'code',
  'schedule_inactive',
  'a paused schedule cannot execute'
);
select is(
  (public.job_execute_transfer_occurrence(
    '51000000-0000-4000-8000-00000000dead',
    '2026-02-05',
    '2026-02-05T18:00:00Z'
  ))->>'code',
  'schedule_not_found',
  'an unknown schedule cannot execute'
);

-- --- Membership removal cleanup ----------------------------------------------
-- Ben's earlier token was reclaimed by Ann's second install above, so register a
-- fresh one to observe the removal cleanup.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
select is(
  (public.register_notification_device(
    '21000000-0000-4000-8000-0000000000d4', 'android', 'ExponentPushToken[b2]'
  ))->>'status',
  'ok',
  'the partner re-registers a device'
);
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
select is(
  (select count(*)::int from public.notification_devices
     where user_id = '00000000-0000-4000-8000-0000000000d2'),
  1,
  'the partner still has a registered device before removal'
);
delete from public.household_members
  where user_id = '00000000-0000-4000-8000-0000000000d2';
select is(
  (select count(*)::int from public.notification_devices
     where user_id = '00000000-0000-4000-8000-0000000000d2'),
  0,
  'a removed member stops receiving this household pushes'
);
select is(
  (select count(*)::int from public.notifications
     where recipient_user_id = '00000000-0000-4000-8000-0000000000d2'),
  0,
  'a removed member inbox rows are cleared'
);

-- --- Account deletion --------------------------------------------------------
insert into public.household_members (
  id, household_id, user_id, display_name, member_role
)
values (
  '11000000-0000-4000-8000-0000000000d4',
  '10000000-0000-4000-8000-0000000000d1',
  '00000000-0000-4000-8000-0000000000d2', 'Ben', 'member'
);
insert into public.profiles (user_id, display_name)
values ('00000000-0000-4000-8000-0000000000d2', 'Ben')
on conflict (user_id) do nothing;

select is(
  (public.admin_prepare_account_deletion(
    '00000000-0000-4000-8000-0000000000d1'
  ))->>'code',
  'must_transfer_ownership',
  'an owner with a partner must hand over the household first'
);

-- the partner authored a note; deleting their account leaves it with the household
insert into public.household_notes (
  id, household_id, title, document, created_by
)
values (
  '52000000-0000-4000-8000-0000000000d1',
  '10000000-0000-4000-8000-0000000000d1',
  'Ben note',
  '{"type":"doc","content":[]}'::jsonb,
  '00000000-0000-4000-8000-0000000000d2'
);

select is(
  (public.admin_prepare_account_deletion(
    '00000000-0000-4000-8000-0000000000d2'
  ))->'details'->>'leftHousehold',
  'true',
  'a non-owner may delete their account and leave'
);
select is(
  (select created_by::text from public.household_notes
     where id = '52000000-0000-4000-8000-0000000000d1'),
  '00000000-0000-4000-8000-0000000000d1',
  'the departing member authored rows are reassigned to the owner'
);
select is(
  (select count(*)::int from public.profiles
     where user_id = '00000000-0000-4000-8000-0000000000d2'),
  0,
  'the departing member profile is removed'
);
select lives_ok(
  $$ delete from auth.users
       where id = '00000000-0000-4000-8000-0000000000d2' $$,
  'the auth user can now be deleted without tripping an authorship constraint'
);

select is(
  (public.admin_prepare_account_deletion(
    '00000000-0000-4000-8000-0000000000d1'
  ))->'details'->>'householdDeleted',
  'true',
  'a sole owner deleting their account deletes the household with it'
);
select is(
  (select count(*)::int from public.households
     where id = '10000000-0000-4000-8000-0000000000d1'),
  0,
  'the household row is gone'
);
select is(
  (public.admin_prepare_account_deletion(
    '00000000-0000-4000-8000-0000000000d3'
  ))->'details'->>'leftHousehold',
  'false',
  'a user with no household deletes only their own account'
);

-- --- Job function grants -----------------------------------------------------
select ok(
  not has_function_privilege(
    'authenticated',
    'public.job_pending_push_notifications(integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.job_pending_push_notifications(integer)', 'EXECUTE'
  )
  and has_function_privilege(
    'service_role', 'public.job_pending_push_notifications(integer)', 'EXECUTE'
  ),
  'push dispatch is reachable only by the service role'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.admin_prepare_account_deletion(uuid)', 'EXECUTE'
  )
  and has_function_privilege(
    'service_role', 'public.admin_prepare_account_deletion(uuid)', 'EXECUTE'
  ),
  'account deletion is reachable only by the service role'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.job_execute_transfer_occurrence(uuid,date,timestamptz)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.job_execute_transfer_occurrence(uuid,date,timestamptz)',
    'EXECUTE'
  ),
  'the transfer executor is reachable only by the service role'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.register_notification_device(uuid,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.register_notification_device(uuid,text,text)',
    'EXECUTE'
  ),
  'device registration is an authenticated client entry point'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.mobile_reassign_authorship(uuid,uuid)', 'EXECUTE'
  ),
  'the authorship reassignment helper is not client-callable'
);

select * from finish();
rollback;
