-- Authoritative durable-operation contract.
--
-- Common command keys exactly match @household-hub/domain OperationCommand.
-- Payloads are strict and reject unknown keys:
-- calendar.event.upsert:
--   title, note, ownerId, allDay, startAt/endAt or startDate/endDate,
--   timezone, recurrenceFrequency, recurrenceUntil, reminders
-- grocery.list.upsert: name, sortOrder
-- grocery.item.upsert:
--   listId, name, quantity, checked, unitPriceCents, sortOrder
-- ledger.asset.upsert: name, kind, currency, balanceCents, sortOrder
-- ledger.year.upsert: year
-- ledger.year.clear: year, confirmation
-- ledger.category.upsert: yearId, fromMonth, name, kind, sortOrder
-- ledger.category.delete: fromMonth
-- ledger.limit.upsert: categoryId, fromMonth, amountCents (nullable)
-- ledger.limit.delete: categoryId, fromMonth
-- ledger.transaction.upsert:
--   yearId, month, categoryId, assetId, kind, amountCents, occurredAt,
--   description
-- ledger.transfer.upsert:
--   fromAssetId, toAssetId, amountCents, occurredAt, note
-- ledger.schedule.upsert:
--   fromAssetId, toAssetId, amountCents, frequency, startsAt, timezone,
--   active
-- note.upsert: title, document
-- trip.upsert:
--   name, destination, timezone, startDate, endDate, destinationCurrency
-- trip.expense.upsert:
--   tripId, assetId, amountCents, currency, spentAt, description
-- notification.read: readAt
-- settings.update: any non-empty subset of
--   displayName, appearance, notificationsEnabled
-- All ordinary delete payloads are empty objects.

create or replace function public.mobile_json_keys_valid(
  candidate jsonb,
  required_keys text[],
  optional_keys text[] default array[]::text[]
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select
    jsonb_typeof(candidate) = 'object'
    and not exists (
      select 1
      from unnest(required_keys) required_key
      where not candidate ? required_key
    )
    and not exists (
      select 1
      from jsonb_object_keys(candidate) actual_key
      where not actual_key = any(required_keys || optional_keys)
    );
$$;

create or replace function public.mobile_json_is_uuid(candidate jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select
    jsonb_typeof(candidate) = 'string'
    and trim(both '"' from candidate::text)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

create or replace function public.mobile_json_is_integer(
  candidate jsonb,
  minimum_value bigint,
  maximum_value bigint
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  parsed numeric;
begin
  if jsonb_typeof(candidate) <> 'number'
     or candidate::text !~ '^-?[0-9]+$' then
    return false;
  end if;

  parsed := candidate::text::numeric;
  return parsed between minimum_value and maximum_value;
exception
  when others then
    return false;
end;
$$;

create or replace function public.mobile_is_iso_instant(candidate text)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  parsed timestamptz;
begin
  if candidate is null
     or candidate !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$' then
    return false;
  end if;
  parsed := candidate::timestamptz;
  return parsed is not null;
exception
  when others then
    return false;
end;
$$;

create or replace function public.mobile_is_iso_date(candidate text)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  parsed date;
begin
  if candidate is null or candidate !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;
  parsed := candidate::date;
  return to_char(parsed, 'YYYY-MM-DD') = candidate;
exception
  when others then
    return false;
end;
$$;

create or replace function public.mobile_note_node_valid(
  node jsonb,
  expected_type text default null
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  node_type text;
  child jsonb;
begin
  if jsonb_typeof(node) <> 'object'
     or jsonb_typeof(node->'type') <> 'string' then
    return false;
  end if;

  node_type := node->>'type';
  if expected_type is not null and node_type <> expected_type then
    return false;
  end if;

  case node_type
    when 'doc' then
      if not public.mobile_json_keys_valid(node, array['type','content'])
         or jsonb_typeof(node->'content') <> 'array' then
        return false;
      end if;
      for child in select value from jsonb_array_elements(node->'content')
      loop
        if child->>'type' not in (
          'paragraph','heading','bulletList','orderedList','taskList'
        ) or not public.mobile_note_node_valid(child) then
          return false;
        end if;
      end loop;
      return true;

    when 'paragraph' then
      if not public.mobile_json_keys_valid(
        node,
        array['type'],
        array['content']
      ) then
        return false;
      end if;
      if not node ? 'content' then
        return true;
      end if;
      if jsonb_typeof(node->'content') <> 'array' then
        return false;
      end if;
      for child in select value from jsonb_array_elements(node->'content')
      loop
        if child->>'type' not in ('text','hardBreak')
           or not public.mobile_note_node_valid(child) then
          return false;
        end if;
      end loop;
      return true;

    when 'text' then
      return
        public.mobile_json_keys_valid(node, array['type','text'])
        and jsonb_typeof(node->'text') = 'string'
        and length(node->>'text') > 0;

    when 'hardBreak' then
      return public.mobile_json_keys_valid(node, array['type']);

    when 'heading' then
      if not public.mobile_json_keys_valid(
        node,
        array['type','attrs'],
        array['content']
      )
      or not public.mobile_json_keys_valid(node->'attrs', array['level'])
      or not public.mobile_json_is_integer(node->'attrs'->'level', 1, 3)
      then
        return false;
      end if;
      if not node ? 'content' then
        return true;
      end if;
      if jsonb_typeof(node->'content') <> 'array' then
        return false;
      end if;
      for child in select value from jsonb_array_elements(node->'content')
      loop
        if child->>'type' not in ('text','hardBreak')
           or not public.mobile_note_node_valid(child) then
          return false;
        end if;
      end loop;
      return true;

    when 'bulletList', 'orderedList' then
      if not public.mobile_json_keys_valid(node, array['type','content'])
         or jsonb_typeof(node->'content') <> 'array' then
        return false;
      end if;
      for child in select value from jsonb_array_elements(node->'content')
      loop
        if not public.mobile_note_node_valid(child, 'listItem') then
          return false;
        end if;
      end loop;
      return true;

    when 'taskList' then
      if not public.mobile_json_keys_valid(node, array['type','content'])
         or jsonb_typeof(node->'content') <> 'array' then
        return false;
      end if;
      for child in select value from jsonb_array_elements(node->'content')
      loop
        if not public.mobile_note_node_valid(child, 'taskItem') then
          return false;
        end if;
      end loop;
      return true;

    when 'listItem' then
      if not public.mobile_json_keys_valid(node, array['type','content'])
         or jsonb_typeof(node->'content') <> 'array' then
        return false;
      end if;
      for child in select value from jsonb_array_elements(node->'content')
      loop
        if child->>'type' not in (
          'paragraph','heading','bulletList','orderedList','taskList'
        ) or not public.mobile_note_node_valid(child) then
          return false;
        end if;
      end loop;
      return true;

    when 'taskItem' then
      if not public.mobile_json_keys_valid(
        node,
        array['type','attrs','content']
      )
      or not public.mobile_json_keys_valid(node->'attrs', array['checked'])
      or jsonb_typeof(node->'attrs'->'checked') <> 'boolean'
      or jsonb_typeof(node->'content') <> 'array'
      then
        return false;
      end if;
      for child in select value from jsonb_array_elements(node->'content')
      loop
        if child->>'type' not in (
          'paragraph','heading','bulletList','orderedList','taskList'
        ) or not public.mobile_note_node_valid(child) then
          return false;
        end if;
      end loop;
      return true;

    else
      return false;
  end case;
end;
$$;

create or replace function public.mobile_rejected_result(
  operation_id uuid,
  rejection_code text,
  rejection_reason text,
  rejection_details jsonb default '{}'::jsonb,
  rejection_warnings jsonb default '[]'::jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'status', 'rejected',
    'operationId', operation_id,
    'code', rejection_code,
    'reason', rejection_reason,
    'details', coalesce(rejection_details, '{}'::jsonb),
    'warnings', coalesce(rejection_warnings, '[]'::jsonb)
  );
$$;

create or replace function public.mobile_store_rejection(
  target_household_id uuid,
  actor_user_id uuid,
  target_device_id uuid,
  target_local_sequence bigint,
  target_operation_id uuid,
  target_command_hash bytea,
  rejection_code text,
  rejection_reason text,
  rejection_details jsonb default '{}'::jsonb,
  rejection_warnings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  rejection jsonb;
begin
  rejection := public.mobile_rejected_result(
    target_operation_id,
    rejection_code,
    rejection_reason,
    rejection_details,
    rejection_warnings
  );

  insert into public.operation_receipts (
    operation_id,
    household_id,
    actor_user_id,
    device_id,
    local_sequence,
    command_hash,
    status,
    result
  )
  values (
    target_operation_id,
    target_household_id,
    actor_user_id,
    target_device_id,
    target_local_sequence,
    target_command_hash,
    'rejected',
    rejection
  );

  return rejection;
end;
$$;

create or replace function public.mobile_asset_balance(target_asset_id uuid)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(sum(amount_cents), 0)::bigint
  from public.asset_postings
  where asset_id = target_asset_id;
$$;

create or replace function public.mobile_add_posting(
  target_household_id uuid,
  target_asset_id uuid,
  target_operation_id uuid,
  target_effect_type text,
  target_effect_id uuid,
  target_leg text,
  target_amount_cents bigint,
  target_occurred_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if target_amount_cents = 0 then
    return;
  end if;

  insert into public.asset_postings (
    household_id,
    asset_id,
    operation_id,
    effect_type,
    effect_id,
    leg,
    amount_cents,
    occurred_at
  )
  values (
    target_household_id,
    target_asset_id,
    target_operation_id,
    target_effect_type,
    target_effect_id,
    target_leg,
    target_amount_cents,
    target_occurred_at
  );
end;
$$;

create or replace function public.mobile_record_cascade_deletion(
  target_household_id uuid,
  target_entity_type text,
  target_entity_id uuid,
  source_revision bigint,
  target_operation_id uuid,
  winning_operation_type text,
  winning_entity_type text,
  winning_entity_id uuid,
  target_applied_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  deleted_revision bigint;
begin
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
    target_household_id,
    target_entity_type,
    target_entity_id,
    source_revision + 1,
    true,
    target_operation_id,
    winning_operation_type,
    winning_entity_type,
    winning_entity_id,
    target_applied_at
  )
  on conflict on constraint household_entity_revisions_pkey do update
  set
    revision = household_entity_revisions.revision + 1,
    deleted = true,
    last_operation_id = excluded.last_operation_id,
    winner_type = excluded.winner_type,
    winner_entity_type = excluded.winner_entity_type,
    winner_entity_id = excluded.winner_entity_id,
    applied_at = excluded.applied_at
  returning revision into deleted_revision;

  insert into public.household_tombstones (
    household_id,
    entity_type,
    entity_id,
    revision,
    operation_id,
    deleted_at
  )
  values (
    target_household_id,
    target_entity_type,
    target_entity_id,
    deleted_revision,
    target_operation_id,
    target_applied_at
  )
  on conflict on constraint
    household_tombstones_household_id_entity_type_entity_id_key
  do update
  set
    revision = excluded.revision,
    operation_id = excluded.operation_id,
    deleted_at = excluded.deleted_at;
end;
$$;

create or replace function public.mobile_record_cascade_update(
  target_household_id uuid,
  target_entity_type text,
  target_entity_id uuid,
  source_revision bigint,
  target_operation_id uuid,
  winning_operation_type text,
  winning_entity_type text,
  winning_entity_id uuid,
  target_applied_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  updated_revision bigint;
begin
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
    target_household_id,
    target_entity_type,
    target_entity_id,
    source_revision + 1,
    false,
    target_operation_id,
    winning_operation_type,
    winning_entity_type,
    winning_entity_id,
    target_applied_at
  )
  on conflict on constraint household_entity_revisions_pkey do update
  set
    revision = household_entity_revisions.revision + 1,
    deleted = false,
    last_operation_id = excluded.last_operation_id,
    winner_type = excluded.winner_type,
    winner_entity_type = excluded.winner_entity_type,
    winner_entity_id = excluded.winner_entity_id,
    applied_at = excluded.applied_at
  returning revision into updated_revision;

  delete from public.household_tombstones ht
  where ht.household_id = target_household_id
    and ht.entity_type = target_entity_type
    and ht.entity_id = target_entity_id;

  return updated_revision;
end;
$$;

create or replace function public.mobile_ensure_ledger_year(
  target_household_id uuid,
  target_year integer,
  actor_user_id uuid,
  source_operation_id uuid,
  source_operation_type text,
  source_entity_type text,
  source_entity_id uuid,
  source_applied_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_year_id uuid;
begin
  select id
  into target_year_id
  from public.ledger_years
  where household_id = target_household_id
    and year = target_year;

  if target_year_id is null then
    target_year_id := gen_random_uuid();

    insert into public.ledger_years (
      id,
      household_id,
      year,
      created_by,
      revision
    )
    values (
      target_year_id,
      target_household_id,
      target_year,
      actor_user_id,
      1
    );

    insert into public.ledger_months (
      household_id,
      year_id,
      month,
      revision
    )
    select target_household_id, target_year_id, month_number, 1
    from generate_series(1, 12) month_number;

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
      target_household_id,
      'ledger_year',
      target_year_id,
      1,
      false,
      source_operation_id,
      source_operation_type,
      source_entity_type,
      source_entity_id,
      source_applied_at
    );
  end if;

  return target_year_id;
end;
$$;

create or replace function public.mobile_ensure_travel_category(
  target_household_id uuid,
  target_year_id uuid,
  actor_user_id uuid,
  source_operation_id uuid,
  source_operation_type text,
  source_entity_type text,
  source_entity_id uuid,
  source_applied_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_category_id uuid;
  target_limit_entity_id uuid;
  target_category_revision bigint := 1;
  target_limit_revision bigint := 1;
  category_existed boolean := false;
  configuration_missing boolean := false;
begin
  select id
  into target_category_id
  from public.ledger_categories
  where year_id = target_year_id
    and system_key = 'travel';

  category_existed := target_category_id is not null;

  if target_category_id is null then
    target_category_id := gen_random_uuid();

    insert into public.ledger_categories (
      id,
      household_id,
      year_id,
      kind,
      system_key,
      created_by,
      revision
    )
    values (
      target_category_id,
      target_household_id,
      target_year_id,
      'spending',
      'travel',
      actor_user_id,
      1
    );
  else
    select exists (
      select 1
      from public.ledger_months lm
      left join public.ledger_month_categories lmc
        on lmc.month_id = lm.id
       and lmc.category_id = target_category_id
      left join public.ledger_month_limits lml
        on lml.month_id = lm.id
       and lml.category_id = target_category_id
      where lm.year_id = target_year_id
        and (lmc.id is null or lml.id is null)
    )
    into configuration_missing;
  end if;

  select lml.limit_entity_id
  into target_limit_entity_id
  from public.ledger_month_limits lml
  where lml.category_id = target_category_id
  order by (lml.limit_entity_id = target_category_id), lml.id
  limit 1;
  target_limit_entity_id := coalesce(
    target_limit_entity_id,
    target_category_id
  );

  if category_existed and configuration_missing then
    select coalesce(er.revision, lc.revision)
    into target_category_revision
    from public.ledger_categories lc
    left join public.household_entity_revisions er
      on er.household_id = lc.household_id
     and er.entity_type = 'ledger_category'
     and er.entity_id = lc.id
    where lc.id = target_category_id;

    target_category_revision := public.mobile_record_cascade_update(
      target_household_id,
      'ledger_category',
      target_category_id,
      target_category_revision,
      source_operation_id,
      source_operation_type,
      source_entity_type,
      source_entity_id,
      source_applied_at
    );

    update public.ledger_categories
    set
      revision = target_category_revision,
      updated_at = source_applied_at
    where id = target_category_id;

    select er.revision
    into target_limit_revision
    from public.household_entity_revisions er
    where er.household_id = target_household_id
      and er.entity_type = 'ledger_limit'
      and er.entity_id = target_limit_entity_id;

    if found then
      target_limit_revision := public.mobile_record_cascade_update(
        target_household_id,
        'ledger_limit',
        target_limit_entity_id,
        target_limit_revision,
        source_operation_id,
        source_operation_type,
        source_entity_type,
        source_entity_id,
        source_applied_at
      );
    else
      select coalesce(max(lml.revision), 1)
      into target_limit_revision
      from public.ledger_month_limits lml
      where lml.category_id = target_category_id;
    end if;
  end if;

  insert into public.ledger_month_categories (
    household_id,
    month_id,
    category_id,
    name,
    sort_order,
    revision
  )
  select
    target_household_id,
    lm.id,
    target_category_id,
    'Travel',
    2147483647,
    target_category_revision
  from public.ledger_months lm
  where lm.year_id = target_year_id
  on conflict (month_id, category_id) do nothing;

  insert into public.ledger_month_limits (
    household_id,
    month_id,
    category_id,
    limit_entity_id,
    amount_cents,
    revision
  )
  select
    target_household_id,
    lm.id,
    target_category_id,
    target_limit_entity_id,
    null,
    target_limit_revision
  from public.ledger_months lm
  join public.ledger_month_categories lmc
    on lmc.month_id = lm.id
   and lmc.category_id = target_category_id
  where lm.year_id = target_year_id
  on conflict (month_id, category_id) do nothing;

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
    target_household_id,
    'ledger_category',
    target_category_id,
    1,
    false,
    source_operation_id,
    source_operation_type,
    source_entity_type,
    source_entity_id,
    source_applied_at
  )
  on conflict on constraint household_entity_revisions_pkey do nothing;

  return target_category_id;
end;
$$;

create or replace function public.mobile_expected_entity_type(
  operation_type text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when operation_type like 'calendar.event.%' then 'calendar_event'
    when operation_type like 'grocery.list.%' then 'grocery_list'
    when operation_type like 'grocery.item.%' then 'grocery_item'
    when operation_type like 'ledger.asset.%' then 'ledger_asset'
    when operation_type like 'ledger.year.%' then 'ledger_year'
    when operation_type like 'ledger.category.%' then 'ledger_category'
    when operation_type like 'ledger.limit.%' then 'ledger_limit'
    when operation_type like 'ledger.transaction.%' then 'ledger_transaction'
    when operation_type like 'ledger.transfer.%' then 'ledger_transfer'
    when operation_type like 'ledger.schedule.%' then 'ledger_schedule'
    when operation_type like 'note.%' then 'note'
    when operation_type like 'trip.expense.%' then 'trip_expense'
    when operation_type like 'trip.%' then 'trip'
    when operation_type = 'notification.read' then 'notification'
    when operation_type = 'settings.update' then 'settings'
    else null
  end;
$$;

create or replace function public.mobile_operation_payload_valid(
  operation_type text,
  payload jsonb
)
returns boolean
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  reminder jsonb;
  reminder_preset text;
  seen_reminders text[] := array[]::text[];
begin
  if jsonb_typeof(payload) <> 'object' then
    return false;
  end if;

  case operation_type
    when 'calendar.event.upsert' then
      if not public.mobile_json_keys_valid(
        payload,
        array[
          'title','note','ownerId','allDay','timezone',
          'recurrenceFrequency','recurrenceUntil','reminders'
        ],
        array['startAt','endAt','startDate','endDate']
      )
      or jsonb_typeof(payload->'title') <> 'string'
      or btrim(payload->>'title') = ''
      or not (
        payload->'note' = 'null'::jsonb
        or jsonb_typeof(payload->'note') = 'string'
      )
      or not (
        payload->'ownerId' = 'null'::jsonb
        or public.mobile_json_is_uuid(payload->'ownerId')
      )
      or jsonb_typeof(payload->'allDay') <> 'boolean'
      or jsonb_typeof(payload->'timezone') <> 'string'
      or not public.mobile_is_iana_timezone(payload->>'timezone')
      or jsonb_typeof(payload->'recurrenceFrequency') <> 'string'
      or payload->>'recurrenceFrequency' not in (
        'none','daily','weekly','monthly','yearly'
      )
      or not (
        payload->'recurrenceUntil' = 'null'::jsonb
        or (
          jsonb_typeof(payload->'recurrenceUntil') = 'string'
          and public.mobile_is_iso_date(payload->>'recurrenceUntil')
        )
      )
      or jsonb_typeof(payload->'reminders') <> 'array'
      then
        return false;
      end if;

      if (payload->>'allDay')::boolean then
        if payload ? 'startAt'
           or payload ? 'endAt'
           or not payload ? 'startDate'
           or not payload ? 'endDate'
           or jsonb_typeof(payload->'startDate') <> 'string'
           or jsonb_typeof(payload->'endDate') <> 'string'
           or not public.mobile_is_iso_date(payload->>'startDate')
           or not public.mobile_is_iso_date(payload->>'endDate')
           or (payload->>'endDate')::date < (payload->>'startDate')::date
        then
          return false;
        end if;
      else
        if payload ? 'startDate'
           or payload ? 'endDate'
           or not payload ? 'startAt'
           or not payload ? 'endAt'
           or jsonb_typeof(payload->'startAt') <> 'string'
           or jsonb_typeof(payload->'endAt') <> 'string'
           or right(payload->>'startAt', 1) <> 'Z'
           or right(payload->>'endAt', 1) <> 'Z'
           or not public.mobile_is_iso_instant(payload->>'startAt')
           or not public.mobile_is_iso_instant(payload->>'endAt')
           or (payload->>'endAt')::timestamptz
              <= (payload->>'startAt')::timestamptz
        then
          return false;
        end if;
      end if;

      for reminder in select value from jsonb_array_elements(payload->'reminders')
      loop
        reminder_preset := trim(both '"' from reminder::text);
        if jsonb_typeof(reminder) <> 'string'
           or reminder_preset not in (
             'at_time','10m','1h','1d','1w'
           )
           or reminder_preset = any(seen_reminders)
        then
          return false;
        end if;
        seen_reminders := array_append(seen_reminders, reminder_preset);
      end loop;
      return true;

    when 'calendar.event.delete',
         'grocery.list.delete',
         'grocery.item.delete',
         'ledger.asset.delete',
         'ledger.transaction.delete',
         'ledger.transfer.delete',
         'ledger.schedule.delete',
         'note.delete',
         'trip.delete',
         'trip.expense.delete' then
      return public.mobile_json_keys_valid(payload, array[]::text[]);

    when 'grocery.list.upsert' then
      return
        public.mobile_json_keys_valid(payload, array['name','sortOrder'])
        and jsonb_typeof(payload->'name') = 'string'
        and btrim(payload->>'name') <> ''
        and public.mobile_json_is_integer(
          payload->'sortOrder',
          -2147483648,
          2147483647
        );

    when 'grocery.item.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'listId','name','quantity','checked','unitPriceCents','sortOrder'
          ]
        )
        and public.mobile_json_is_uuid(payload->'listId')
        and jsonb_typeof(payload->'name') = 'string'
        and btrim(payload->>'name') <> ''
        and (
          payload->'quantity' = 'null'::jsonb
          or jsonb_typeof(payload->'quantity') = 'string'
        )
        and jsonb_typeof(payload->'checked') = 'boolean'
        and (
          payload->'unitPriceCents' = 'null'::jsonb
          or public.mobile_json_is_integer(
            payload->'unitPriceCents',
            0,
            9007199254740991
          )
        )
        and public.mobile_json_is_integer(
          payload->'sortOrder',
          -2147483648,
          2147483647
        );

    when 'ledger.asset.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array['name','kind','currency','balanceCents','sortOrder']
        )
        and jsonb_typeof(payload->'name') = 'string'
        and btrim(payload->>'name') <> ''
        and jsonb_typeof(payload->'kind') = 'string'
        and payload->>'kind' in (
          'cash','checking','savings','credit','investment','other'
        )
        and jsonb_typeof(payload->'currency') = 'string'
        and public.mobile_is_iso_currency_code(payload->>'currency')
        and public.mobile_json_is_integer(
          payload->'balanceCents',
          -9007199254740991,
          9007199254740991
        )
        and public.mobile_json_is_integer(
          payload->'sortOrder',
          -2147483648,
          2147483647
        );

    when 'ledger.year.upsert' then
      return
        public.mobile_json_keys_valid(payload, array['year'])
        and public.mobile_json_is_integer(payload->'year', 1900, 9999);

    when 'ledger.year.clear' then
      return
        public.mobile_json_keys_valid(payload, array['year','confirmation'])
        and public.mobile_json_is_integer(payload->'year', 1900, 9999)
        and jsonb_typeof(payload->'confirmation') = 'string';

    when 'ledger.category.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array['yearId','fromMonth','name','kind','sortOrder']
        )
        and public.mobile_json_is_uuid(payload->'yearId')
        and public.mobile_json_is_integer(payload->'fromMonth', 1, 12)
        and jsonb_typeof(payload->'name') = 'string'
        and btrim(payload->>'name') <> ''
        and jsonb_typeof(payload->'kind') = 'string'
        and payload->>'kind' in ('income','spending')
        and public.mobile_json_is_integer(
          payload->'sortOrder',
          -2147483648,
          2147483647
        );

    when 'ledger.category.delete' then
      return
        public.mobile_json_keys_valid(payload, array['fromMonth'])
        and public.mobile_json_is_integer(payload->'fromMonth', 1, 12);

    when 'ledger.limit.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array['categoryId','fromMonth','amountCents']
        )
        and public.mobile_json_is_uuid(payload->'categoryId')
        and public.mobile_json_is_integer(payload->'fromMonth', 1, 12)
        and (
          payload->'amountCents' = 'null'::jsonb
          or public.mobile_json_is_integer(
            payload->'amountCents',
            0,
            9007199254740991
          )
        );

    when 'ledger.limit.delete' then
      return
        public.mobile_json_keys_valid(
          payload,
          array['categoryId','fromMonth']
        )
        and public.mobile_json_is_uuid(payload->'categoryId')
        and public.mobile_json_is_integer(payload->'fromMonth', 1, 12);

    when 'ledger.transaction.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'yearId','month','categoryId','assetId','kind','amountCents',
            'occurredAt','description'
          ]
        )
        and public.mobile_json_is_uuid(payload->'yearId')
        and public.mobile_json_is_integer(payload->'month', 1, 12)
        and public.mobile_json_is_uuid(payload->'categoryId')
        and public.mobile_json_is_uuid(payload->'assetId')
        and jsonb_typeof(payload->'kind') = 'string'
        and payload->>'kind' in ('income','spending')
        and public.mobile_json_is_integer(
          payload->'amountCents',
          1,
          9007199254740991
        )
        and jsonb_typeof(payload->'occurredAt') = 'string'
        and public.mobile_is_iso_instant(payload->>'occurredAt')
        and jsonb_typeof(payload->'description') = 'string'
        and btrim(payload->>'description') <> '';

    when 'ledger.transfer.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'fromAssetId','toAssetId','amountCents','occurredAt','note'
          ]
        )
        and public.mobile_json_is_uuid(payload->'fromAssetId')
        and public.mobile_json_is_uuid(payload->'toAssetId')
        and payload->>'fromAssetId' <> payload->>'toAssetId'
        and public.mobile_json_is_integer(
          payload->'amountCents',
          1,
          9007199254740991
        )
        and jsonb_typeof(payload->'occurredAt') = 'string'
        and public.mobile_is_iso_instant(payload->>'occurredAt')
        and (
          payload->'note' = 'null'::jsonb
          or jsonb_typeof(payload->'note') = 'string'
        );

    when 'ledger.schedule.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'fromAssetId','toAssetId','amountCents','frequency','startsAt',
            'timezone','active'
          ]
        )
        and public.mobile_json_is_uuid(payload->'fromAssetId')
        and public.mobile_json_is_uuid(payload->'toAssetId')
        and payload->>'fromAssetId' <> payload->>'toAssetId'
        and public.mobile_json_is_integer(
          payload->'amountCents',
          1,
          9007199254740991
        )
        and jsonb_typeof(payload->'frequency') = 'string'
        and payload->>'frequency' in (
          'weekly','biweekly','semi_monthly','monthly'
        )
        and jsonb_typeof(payload->'startsAt') = 'string'
        and public.mobile_is_iso_instant(payload->>'startsAt')
        and jsonb_typeof(payload->'timezone') = 'string'
        and public.mobile_is_iana_timezone(payload->>'timezone')
        and jsonb_typeof(payload->'active') = 'boolean';

    when 'note.upsert' then
      return
        public.mobile_json_keys_valid(payload, array['title','document'])
        and jsonb_typeof(payload->'title') = 'string'
        and btrim(payload->>'title') <> ''
        and public.mobile_note_node_valid(payload->'document', 'doc');

    when 'trip.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'name','destination','timezone','startDate','endDate',
            'destinationCurrency'
          ]
        )
        and jsonb_typeof(payload->'name') = 'string'
        and btrim(payload->>'name') <> ''
        and jsonb_typeof(payload->'destination') = 'string'
        and btrim(payload->>'destination') <> ''
        and jsonb_typeof(payload->'timezone') = 'string'
        and public.mobile_is_iana_timezone(payload->>'timezone')
        and jsonb_typeof(payload->'startDate') = 'string'
        and jsonb_typeof(payload->'endDate') = 'string'
        and public.mobile_is_iso_date(payload->>'startDate')
        and public.mobile_is_iso_date(payload->>'endDate')
        and (payload->>'endDate')::date >= (payload->>'startDate')::date
        and jsonb_typeof(payload->'destinationCurrency') = 'string'
        and public.mobile_is_iso_currency_code(
          payload->>'destinationCurrency'
        );

    when 'trip.expense.upsert' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[
            'tripId','assetId','amountCents','currency','spentAt',
            'description'
          ]
        )
        and public.mobile_json_is_uuid(payload->'tripId')
        and public.mobile_json_is_uuid(payload->'assetId')
        and public.mobile_json_is_integer(
          payload->'amountCents',
          1,
          9007199254740991
        )
        and jsonb_typeof(payload->'currency') = 'string'
        and public.mobile_is_iso_currency_code(payload->>'currency')
        and jsonb_typeof(payload->'spentAt') = 'string'
        and public.mobile_is_iso_instant(payload->>'spentAt')
        and jsonb_typeof(payload->'description') = 'string'
        and btrim(payload->>'description') <> '';

    when 'notification.read' then
      return
        public.mobile_json_keys_valid(payload, array['readAt'])
        and jsonb_typeof(payload->'readAt') = 'string'
        and public.mobile_is_iso_instant(payload->>'readAt');

    when 'settings.update' then
      return
        public.mobile_json_keys_valid(
          payload,
          array[]::text[],
          array['displayName','appearance','notificationsEnabled']
        )
        and payload <> '{}'::jsonb
        and (
          not payload ? 'displayName'
          or (
            jsonb_typeof(payload->'displayName') = 'string'
            and btrim(payload->>'displayName') <> ''
          )
        )
        and (
          not payload ? 'appearance'
          or (
            jsonb_typeof(payload->'appearance') = 'string'
            and payload->>'appearance' in ('light','dark','system')
          )
        )
        and (
          not payload ? 'notificationsEnabled'
          or jsonb_typeof(payload->'notificationsEnabled') = 'boolean'
        );

    else
      return false;
  end case;
end;
$$;

create or replace function public.apply_household_operation(command jsonb)
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
  expected_entity_type text;
  payload jsonb;
  local_sequence bigint;
  base_revision bigint;
  next_revision bigint;
  server_sequence bigint;
  command_hash bytea;
  applied_at timestamptz := clock_timestamp();
  receipt public.operation_receipts%rowtype;
  current_entity public.household_entity_revisions%rowtype;
  has_current boolean := false;
  deleted_entity boolean := false;
  result jsonb;
  warning jsonb;
  details jsonb := '{}'::jsonb;
  change_kind text := 'upsert';
  old_row record;
  related_row record;
  row_count integer;
  desired_balance bigint;
  current_balance bigint;
  delta_cents bigint;
  amount_cents bigint;
  from_month integer;
  target_year integer;
  target_year_id uuid;
  target_month_id uuid;
  target_category_id uuid;
  target_asset_id uuid;
  target_trip_id uuid;
  previous_destination_id uuid;
  generated_transaction_id uuid;
  existing_limit_entity_id uuid;
  related_revision bigint;
  prior_limit bigint;
  blocking_months jsonb;
  detached_trip_ids jsonb;
  detached_trip_count integer := 0;
  from_currency text;
  to_currency text;
  expense_currency text;
begin
  if jsonb_typeof(command) <> 'object' then
    raise invalid_parameter_value using message = 'command must be an object';
  end if;

  if not public.mobile_json_is_uuid(command->'operationId') then
    raise invalid_parameter_value using message = 'operationId must be a UUID';
  end if;
  operation_id := (command->>'operationId')::uuid;

  if not public.mobile_json_is_uuid(command->'householdId') then
    raise invalid_parameter_value using message = 'householdId must be a UUID';
  end if;
  household_id := (command->>'householdId')::uuid;

  if not public.mobile_json_is_uuid(command->'deviceId') then
    raise invalid_parameter_value using message = 'deviceId must be a UUID';
  end if;
  device_id := (command->>'deviceId')::uuid;

  if not public.mobile_json_is_uuid(command->'entityId') then
    raise invalid_parameter_value using message = 'entityId must be a UUID';
  end if;
  entity_id := (command->>'entityId')::uuid;

  if not public.mobile_json_is_integer(
    command->'localSequence',
    0,
    9007199254740991
  ) then
    raise invalid_parameter_value
      using message = 'localSequence must be a nonnegative safe integer';
  end if;
  local_sequence := (command->>'localSequence')::bigint;

  if not (
    command->'baseRevision' = 'null'::jsonb
    or public.mobile_json_is_integer(
      command->'baseRevision',
      1,
      9007199254740991
    )
  ) then
    raise invalid_parameter_value
      using message = 'baseRevision must be null or a positive safe integer';
  end if;
  base_revision := case
    when command->'baseRevision' = 'null'::jsonb then null
    else (command->>'baseRevision')::bigint
  end;

  if jsonb_typeof(command->'type') <> 'string'
     or jsonb_typeof(command->'entityType') <> 'string'
     or jsonb_typeof(command->'enqueuedAt') <> 'string'
     or not public.mobile_is_iso_instant(command->>'enqueuedAt')
     or jsonb_typeof(command->'payload') <> 'object'
  then
    raise invalid_parameter_value using message = 'command envelope is invalid';
  end if;

  operation_type := command->>'type';
  entity_type := command->>'entityType';
  payload := command->'payload';

  actor_id := auth.uid();
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  if not exists (
    select 1
    from public.household_members hm
    where hm.household_id = household_id
      and hm.user_id = actor_id
  ) then
    raise insufficient_privilege
      using message = 'caller is not a member of the household';
  end if;

  -- Locking the trusted tenant row serializes all writes for this household.
  perform 1
  from public.households h
  where h.id = household_id
  for update;

  -- Hold the authorization row through commit so removal cannot race the
  -- SECURITY DEFINER mutation after this recheck.
  perform 1
  from public.household_members hm
  where hm.household_id = household_id
    and hm.user_id = actor_id
  for key share;

  if not found then
    raise insufficient_privilege
      using message = 'caller is not a member of the household';
  end if;

  command_hash := extensions.digest(command::text, 'sha256');

  select *
  into receipt
  from public.operation_receipts operation_receipt
  where operation_receipt.operation_id =
    operation_id;

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
  ) then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'invalid_command',
      'Command has missing or unexpected keys'
    );
  end if;

  if not public.mobile_json_is_integer(command->'schemaVersion', 1, 1) then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'unsupported_schema_version',
      'Unsupported operation schema version'
    );
  end if;

  expected_entity_type :=
    public.mobile_expected_entity_type(operation_type);
  if expected_entity_type is null then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'unsupported_operation',
      'Unsupported operation type'
    );
  end if;

  if entity_type <> expected_entity_type then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'entity_type_mismatch',
      'Entity type does not match operation type',
      jsonb_build_object('expectedEntityType', expected_entity_type)
    );
  end if;

  if not public.mobile_operation_payload_valid(operation_type, payload) then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'invalid_payload',
      'Operation payload is invalid for its type'
    );
  end if;

  -- Notifications originate outside this RPC in the reminder/activity jobs.
  -- Bootstrap their revision metadata on the first recipient read.
  if operation_type = 'notification.read'
     and not exists (
       select 1
       from public.household_entity_revisions er
       where er.household_id = household_id
         and er.entity_type = entity_type
         and er.entity_id = entity_id
     )
  then
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
    select
      n.household_id,
      'notification',
      n.id,
      n.revision,
      false,
      n.id,
      'notification.read',
      'notification',
      n.id,
      n.created_at
    from public.notifications n
    where n.id = entity_id
      and n.household_id = household_id
    on conflict do nothing;
  end if;

  select *
  into current_entity
  from public.household_entity_revisions er
  where er.household_id = household_id
    and er.entity_type = entity_type
    and er.entity_id = entity_id
  for update;
  has_current := found;

  if not has_current and base_revision is not null then
    return public.mobile_store_rejection(
      household_id,
      actor_id,
      device_id,
      local_sequence,
      operation_id,
      command_hash,
      'entity_not_found',
      'The entity does not exist at the supplied revision'
    );
  end if;

  if has_current
     and base_revision is distinct from current_entity.revision then
    result := jsonb_build_object(
      'status', 'conflict',
      'operationId', operation_id,
      'reason', 'Entity was changed by another operation',
      'currentRevision', current_entity.revision,
      'winner', jsonb_build_object(
        'operationId', current_entity.last_operation_id,
        'type', current_entity.winner_type,
        'entityType', current_entity.winner_entity_type,
        'entityId', current_entity.winner_entity_id,
        'appliedAt', to_char(
          current_entity.applied_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
    );

    insert into public.operation_receipts (
      operation_id,
      household_id,
      actor_user_id,
      device_id,
      local_sequence,
      command_hash,
      status,
      result
    )
    values (
      operation_id,
      household_id,
      actor_id,
      device_id,
      local_sequence,
      command_hash,
      'conflict',
      result
    );

    return result;
  end if;

  next_revision := case
    when has_current then current_entity.revision + 1
    else 1
  end;

  case operation_type
    when 'calendar.event.upsert' then
      if payload->'ownerId' <> 'null'::jsonb
         and not exists (
           select 1
           from public.household_members hm
           where hm.household_id = household_id
             and hm.user_id = (payload->>'ownerId')::uuid
         )
      then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_owner',
          'Calendar owner must belong to the household'
        );
      end if;

      if has_current and not current_entity.deleted then
        update public.calendar_events
        set
          owner_id = case
            when payload->'ownerId' = 'null'::jsonb then null
            else (payload->>'ownerId')::uuid
          end,
          title = payload->>'title',
          note = case
            when payload->'note' = 'null'::jsonb then null
            else payload->>'note'
          end,
          all_day = (payload->>'allDay')::boolean,
          start_at = case
            when (payload->>'allDay')::boolean then null
            else (payload->>'startAt')::timestamptz
          end,
          end_at = case
            when (payload->>'allDay')::boolean then null
            else (payload->>'endAt')::timestamptz
          end,
          start_date = case
            when (payload->>'allDay')::boolean
              then (payload->>'startDate')::date
            else null
          end,
          end_date = case
            when (payload->>'allDay')::boolean
              then (payload->>'endDate')::date
            else null
          end,
          event_timezone = payload->>'timezone',
          recurrence_freq =
            (payload->>'recurrenceFrequency')::public.calendar_recurrence_freq,
          recurrence_until = case
            when payload->'recurrenceUntil' = 'null'::jsonb then null
            else (payload->>'recurrenceUntil')::date
          end,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id and calendar_events.household_id = household_id;
      else
        insert into public.calendar_events (
          id,
          household_id,
          owner_id,
          created_by,
          title,
          note,
          all_day,
          start_at,
          end_at,
          start_date,
          end_date,
          event_timezone,
          recurrence_freq,
          recurrence_until,
          revision
        )
        values (
          entity_id,
          household_id,
          case
            when payload->'ownerId' = 'null'::jsonb then null
            else (payload->>'ownerId')::uuid
          end,
          actor_id,
          payload->>'title',
          case
            when payload->'note' = 'null'::jsonb then null
            else payload->>'note'
          end,
          (payload->>'allDay')::boolean,
          case
            when (payload->>'allDay')::boolean then null
            else (payload->>'startAt')::timestamptz
          end,
          case
            when (payload->>'allDay')::boolean then null
            else (payload->>'endAt')::timestamptz
          end,
          case
            when (payload->>'allDay')::boolean
              then (payload->>'startDate')::date
            else null
          end,
          case
            when (payload->>'allDay')::boolean
              then (payload->>'endDate')::date
            else null
          end,
          payload->>'timezone',
          (payload->>'recurrenceFrequency')::public.calendar_recurrence_freq,
          case
            when payload->'recurrenceUntil' = 'null'::jsonb then null
            else (payload->>'recurrenceUntil')::date
          end,
          next_revision
        );
      end if;

      delete from public.calendar_event_reminders
      where event_id = entity_id;

      insert into public.calendar_event_reminders (
        household_id,
        event_id,
        preset,
        revision
      )
      select household_id, entity_id, value, next_revision
      from jsonb_array_elements_text(payload->'reminders');

    when 'calendar.event.delete' then
      delete from public.calendar_events
      where id = entity_id and calendar_events.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'grocery.list.upsert' then
      if has_current and not current_entity.deleted then
        update public.household_grocery_lists
        set
          name = payload->>'name',
          sort_order = (payload->>'sortOrder')::integer,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id
          and household_grocery_lists.household_id = household_id;
      else
        insert into public.household_grocery_lists (
          id, household_id, name, sort_order, created_by, revision
        )
        values (
          entity_id,
          household_id,
          payload->>'name',
          (payload->>'sortOrder')::integer,
          actor_id,
          next_revision
        );
      end if;

    when 'grocery.list.delete' then
      delete from public.household_grocery_lists
      where id = entity_id
        and household_grocery_lists.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'grocery.item.upsert' then
      if not exists (
        select 1
        from public.household_grocery_lists gl
        where gl.id = (payload->>'listId')::uuid
          and gl.household_id = household_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_list', 'Grocery list is not in the household'
        );
      end if;

      select *
      into old_row
      from public.household_grocery_items gi
      where gi.id = entity_id
        and gi.household_id = household_id;

      if found then
        update public.household_grocery_items
        set
          list_id = (payload->>'listId')::uuid,
          name = payload->>'name',
          quantity = case
            when payload->'quantity' = 'null'::jsonb then null
            else payload->>'quantity'
          end,
          checked = (payload->>'checked')::boolean,
          unit_price_cents = case
            when payload->'unitPriceCents' = 'null'::jsonb then null
            else (payload->>'unitPriceCents')::bigint
          end,
          sort_order = (payload->>'sortOrder')::integer,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;
      else
        insert into public.household_grocery_items (
          id,
          household_id,
          list_id,
          name,
          quantity,
          checked,
          unit_price_cents,
          sort_order,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          (payload->>'listId')::uuid,
          payload->>'name',
          case
            when payload->'quantity' = 'null'::jsonb then null
            else payload->>'quantity'
          end,
          (payload->>'checked')::boolean,
          case
            when payload->'unitPriceCents' = 'null'::jsonb then null
            else (payload->>'unitPriceCents')::bigint
          end,
          (payload->>'sortOrder')::integer,
          actor_id,
          next_revision
        );
      end if;

      if payload->'unitPriceCents' <> 'null'::jsonb
         and (payload->>'unitPriceCents')::bigint > 0
         and (
           old_row.id is null
           or old_row.unit_price_cents is distinct from
              (payload->>'unitPriceCents')::bigint
         )
      then
        insert into public.household_grocery_price_history (
          household_id,
          list_id,
          item_name,
          item_name_normalized,
          price_cents,
          recorded_by,
          recorded_at
        )
        values (
          household_id,
          (payload->>'listId')::uuid,
          payload->>'name',
          lower(btrim(payload->>'name')),
          (payload->>'unitPriceCents')::bigint,
          actor_id,
          applied_at
        );
      end if;

    when 'grocery.item.delete' then
      delete from public.household_grocery_items
      where id = entity_id
        and household_grocery_items.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'ledger.asset.upsert' then
      desired_balance := (payload->>'balanceCents')::bigint;
      select *
      into old_row
      from public.ledger_assets la
      where la.id = entity_id
        and la.household_id = household_id;

      if found then
        if old_row.currency_code <> payload->>'currency'
           and (
             exists (
               select 1
               from public.asset_postings ap
               where ap.asset_id = entity_id
             )
             or exists (
               select 1
               from public.ledger_transfers lt
               where lt.from_asset_id = entity_id
                  or lt.to_asset_id = entity_id
             )
             or exists (
               select 1
               from public.ledger_transfer_schedules lts
               where lts.from_asset_id = entity_id
                  or lts.to_asset_id = entity_id
             )
             or exists (
               select 1
               from public.ledger_transactions lt
               where lt.asset_id = entity_id
             )
             or exists (
               select 1
               from public.trip_expenses te
               where te.asset_id = entity_id
             )
           )
        then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'asset_currency_locked',
            'Asset currency cannot change after it is referenced'
          );
        end if;

        current_balance := public.mobile_asset_balance(entity_id);
        update public.ledger_assets
        set
          name = payload->>'name',
          kind = payload->>'kind',
          currency_code = payload->>'currency',
          sort_order = (payload->>'sortOrder')::integer,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;
        delta_cents := desired_balance - current_balance;
        perform public.mobile_add_posting(
          household_id,
          entity_id,
          operation_id,
          'ledger_asset',
          entity_id,
          'balance_adjustment',
          delta_cents,
          applied_at
        );
      else
        insert into public.ledger_assets (
          id,
          household_id,
          name,
          kind,
          currency_code,
          sort_order,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          payload->>'name',
          payload->>'kind',
          payload->>'currency',
          (payload->>'sortOrder')::integer,
          actor_id,
          next_revision
        );
        perform public.mobile_add_posting(
          household_id,
          entity_id,
          operation_id,
          'ledger_asset',
          entity_id,
          'opening',
          desired_balance,
          applied_at
        );
      end if;

      current_balance := public.mobile_asset_balance(entity_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', entity_id,
          'balanceCents', current_balance
        );
      end if;

    when 'ledger.asset.delete' then
      if exists (
        select 1
        from public.asset_postings ap
        where ap.asset_id = entity_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'asset_has_history',
          'Asset with posting history cannot be deleted'
        );
      end if;
      delete from public.ledger_assets
      where id = entity_id and ledger_assets.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'ledger.year.upsert' then
      target_year := (payload->>'year')::integer;
      if exists (
        select 1
        from public.ledger_years ly
        where ly.household_id = household_id
          and ly.year = target_year
          and ly.id <> entity_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'year_already_exists',
          'A different Ledger year entity already uses this year'
        );
      end if;

      select *
      into old_row
      from public.ledger_years ly
      where ly.id = entity_id
        and ly.household_id = household_id;

      if found then
        if old_row.year <> target_year then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'year_value_immutable',
            'A Ledger year number cannot be changed'
          );
        end if;
        update public.ledger_years
        set revision = next_revision, updated_at = applied_at
        where id = entity_id;
      else
        insert into public.ledger_years (
          id, household_id, year, created_by, revision
        )
        values (
          entity_id, household_id, target_year, actor_id, next_revision
        );
        insert into public.ledger_months (
          household_id, year_id, month, revision
        )
        select household_id, entity_id, month_number, 1
        from generate_series(1, 12) month_number;
      end if;

    when 'ledger.year.clear' then
      target_year := (payload->>'year')::integer;
      if payload->>'confirmation' <> target_year::text then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'typed_year_mismatch',
          'Typed year confirmation does not match the target year',
          jsonb_build_object('expectedYear', target_year)
        );
      end if;

      select *
      into old_row
      from public.ledger_years ly
      where ly.id = entity_id
        and ly.household_id = household_id;
      if not found or old_row.year <> target_year then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'year_not_found',
          'Ledger year does not match the target'
        );
      end if;

      for related_row in
        select
          'ledger_category'::text as entity_type,
          lc.id as entity_id,
          lc.revision as source_revision
        from public.ledger_categories lc
        where lc.year_id = entity_id
          and lc.household_id = household_id
        union all
        select
          'ledger_limit',
          lml.limit_entity_id,
          max(lml.revision)
        from public.ledger_month_limits lml
        join public.ledger_months lm on lm.id = lml.month_id
        where lm.year_id = entity_id
          and lml.household_id = household_id
        group by lml.limit_entity_id
        union all
        select
          'ledger_transaction',
          lt.id,
          lt.revision
        from public.ledger_transactions lt
        where lt.year_id = entity_id
          and lt.household_id = household_id
      loop
        perform public.mobile_record_cascade_deletion(
          household_id,
          related_row.entity_type,
          related_row.entity_id,
          related_row.source_revision,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
      end loop;

      select
        count(*)::integer,
        coalesce(jsonb_agg(lt.trip_expense_id order by lt.trip_expense_id),
          '[]'::jsonb)
      into detached_trip_count, detached_trip_ids
      from public.ledger_transactions lt
      where lt.year_id = entity_id
        and lt.trip_expense_id is not null;

      for old_row in
        select *
        from public.ledger_transactions lt
        where lt.year_id = entity_id
          and lt.trip_expense_id is null
      loop
        perform public.mobile_add_posting(
          household_id,
          old_row.asset_id,
          operation_id,
          'ledger_year_clear',
          old_row.id,
          'reversal',
          case
            when old_row.kind = 'income'
              then -old_row.amount_cents
            else old_row.amount_cents
          end,
          applied_at
        );
      end loop;

      update public.trip_expenses te
      set ledger_transaction_id = null, updated_at = applied_at
      where te.ledger_transaction_id in (
        select lt.id
        from public.ledger_transactions lt
        where lt.year_id = entity_id
          and lt.trip_expense_id is not null
      );

      delete from public.ledger_years where id = entity_id;
      deleted_entity := true;
      change_kind := 'clear';
      details := jsonb_build_object(
        'detachedTripExpenseCount', detached_trip_count,
        'detachedTripExpenseIds', detached_trip_ids
      );

    when 'ledger.category.upsert' then
      target_year_id := (payload->>'yearId')::uuid;
      from_month := (payload->>'fromMonth')::integer;
      if not exists (
        select 1
        from public.ledger_years ly
        where ly.id = target_year_id
          and ly.household_id = household_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_year',
          'Ledger year is not in the household'
        );
      end if;

      select *
      into old_row
      from public.ledger_categories lc
      where lc.id = entity_id
        and lc.household_id = household_id;

      if found then
        if old_row.year_id <> target_year_id
           or old_row.kind <> payload->>'kind' then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'category_identity_immutable',
            'Category year and kind cannot change'
          );
        end if;
        update public.ledger_categories
        set revision = next_revision, updated_at = applied_at
        where id = entity_id;
      else
        insert into public.ledger_categories (
          id,
          household_id,
          year_id,
          kind,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          target_year_id,
          payload->>'kind',
          actor_id,
          next_revision
        );
      end if;

      if payload->>'kind' = 'spending' then
        select lml.limit_entity_id
        into existing_limit_entity_id
        from public.ledger_month_limits lml
        where lml.category_id = entity_id
        order by (lml.limit_entity_id = entity_id), lml.id
        limit 1;

        select er.revision
        into related_revision
        from public.household_entity_revisions er
        where er.household_id = household_id
          and er.entity_type = 'ledger_limit'
          and er.entity_id = existing_limit_entity_id;

        if related_revision is not null
           and exists (
             select 1
             from public.ledger_months lm
             left join public.ledger_month_limits lml
               on lml.month_id = lm.id
              and lml.category_id = entity_id
             where lm.year_id = target_year_id
               and lm.month >= from_month
               and lml.id is null
           )
        then
          related_revision := public.mobile_record_cascade_update(
            household_id,
            'ledger_limit',
            existing_limit_entity_id,
            related_revision,
            operation_id,
            operation_type,
            entity_type,
            entity_id,
            applied_at
          );
        end if;
      end if;

      insert into public.ledger_month_categories (
        household_id,
        month_id,
        category_id,
        name,
        sort_order,
        revision
      )
      select
        household_id,
        lm.id,
        entity_id,
        payload->>'name',
        (payload->>'sortOrder')::integer,
        next_revision
      from public.ledger_months lm
      where lm.year_id = target_year_id
        and lm.month >= from_month
      on conflict (month_id, category_id) do update
      set
        name = excluded.name,
        sort_order = excluded.sort_order,
        revision = excluded.revision,
        updated_at = applied_at;

      if payload->>'kind' = 'spending' then
        select lml.limit_entity_id
        into existing_limit_entity_id
        from public.ledger_month_limits lml
        where lml.category_id = entity_id
        order by (lml.limit_entity_id = entity_id), lml.id
        limit 1;
        existing_limit_entity_id := coalesce(
          existing_limit_entity_id,
          entity_id
        );

        insert into public.ledger_month_limits (
          household_id,
          month_id,
          category_id,
          limit_entity_id,
          amount_cents,
          revision
        )
        select
          household_id,
          lm.id,
          entity_id,
          existing_limit_entity_id,
          null,
          coalesce(related_revision, next_revision)
        from public.ledger_months lm
        where lm.year_id = target_year_id
          and lm.month >= from_month
        on conflict (month_id, category_id) do nothing;
      end if;

    when 'ledger.category.delete' then
      from_month := (payload->>'fromMonth')::integer;
      select lc.year_id
      into target_year_id
      from public.ledger_categories lc
      where lc.id = entity_id
        and lc.household_id = household_id;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'category_not_found', 'Ledger category was not found'
        );
      end if;

      select coalesce(
        jsonb_agg(to_char(blocking.month, 'FM00') order by blocking.month),
        '[]'::jsonb
      )
      into blocking_months
      from (
        select distinct lm.month
        from public.ledger_transactions lt
        join public.ledger_months lm on lm.id = lt.month_id
        where lt.category_id = entity_id
          and lm.month >= from_month
      ) blocking;

      if jsonb_array_length(blocking_months) > 0 then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'category_has_spending',
          'Category has spending in selected or later months',
          jsonb_build_object('blockingMonths', blocking_months)
        );
      end if;

      select lml.limit_entity_id
      into existing_limit_entity_id
      from public.ledger_month_limits lml
      where lml.category_id = entity_id
      order by (lml.limit_entity_id = entity_id), lml.id
      limit 1;

      select er.revision
      into related_revision
      from public.household_entity_revisions er
      where er.household_id = household_id
        and er.entity_type = 'ledger_limit'
        and er.entity_id = existing_limit_entity_id;

      delete from public.ledger_month_categories lmc
      using public.ledger_months lm
      where lmc.month_id = lm.id
        and lmc.category_id = entity_id
        and lm.year_id = target_year_id
        and lm.month >= from_month;

      if not exists (
        select 1
        from public.ledger_month_categories lmc
        where lmc.category_id = entity_id
      ) then
        if related_revision is not null then
          perform public.mobile_record_cascade_deletion(
            household_id,
            'ledger_limit',
            existing_limit_entity_id,
            related_revision,
            operation_id,
            operation_type,
            entity_type,
            entity_id,
            applied_at
          );
        end if;
        delete from public.ledger_categories where id = entity_id;
        deleted_entity := true;
      else
        update public.ledger_categories
        set
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;

        if related_revision is not null then
          related_revision := public.mobile_record_cascade_update(
            household_id,
            'ledger_limit',
            existing_limit_entity_id,
            related_revision,
            operation_id,
            operation_type,
            entity_type,
            entity_id,
            applied_at
          );

          update public.ledger_month_limits
          set
            revision = related_revision,
            updated_at = applied_at
          where category_id = entity_id
            and limit_entity_id = existing_limit_entity_id;
        end if;
      end if;
      change_kind := 'delete';

    when 'ledger.limit.upsert' then
      target_category_id := (payload->>'categoryId')::uuid;
      from_month := (payload->>'fromMonth')::integer;
      select lc.year_id, lc.kind
      into target_year_id, from_currency
      from public.ledger_categories lc
      where lc.id = target_category_id
        and lc.household_id = household_id;
      if not found or from_currency <> 'spending' then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_spending_category',
          'Limits apply only to a household spending category'
        );
      end if;

      select lml.limit_entity_id
      into existing_limit_entity_id
      from public.ledger_month_limits lml
      where lml.category_id = target_category_id
      order by (lml.limit_entity_id = target_category_id), lml.id
      limit 1;

      if found
         and existing_limit_entity_id <> entity_id
         and (
           existing_limit_entity_id <> target_category_id
           or exists (
             select 1
             from public.household_entity_revisions er
             where er.household_id = household_id
               and er.entity_type = 'ledger_limit'
               and er.entity_id = existing_limit_entity_id
           )
         )
      then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'limit_identity_conflict',
          'Category limits already use a different entity identity',
          jsonb_build_object(
            'existingLimitEntityId', existing_limit_entity_id
          )
        );
      end if;

      if has_current and exists (
        select 1
        from public.ledger_month_limits lml
        where lml.limit_entity_id = entity_id
          and lml.category_id <> target_category_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'limit_category_immutable',
          'Limit entity cannot move to another category'
        );
      end if;

      if existing_limit_entity_id = target_category_id
         and existing_limit_entity_id <> entity_id
      then
        update public.ledger_month_limits
        set
          limit_entity_id = entity_id,
          updated_at = applied_at
        where category_id = target_category_id;
      end if;

      insert into public.ledger_month_limits (
        household_id,
        month_id,
        category_id,
        limit_entity_id,
        amount_cents,
        revision
      )
      select
        household_id,
        lm.id,
        target_category_id,
        entity_id,
        case
          when payload->'amountCents' = 'null'::jsonb then null
          else (payload->>'amountCents')::bigint
        end,
        next_revision
      from public.ledger_months lm
      join public.ledger_month_categories lmc
        on lmc.month_id = lm.id
       and lmc.category_id = target_category_id
      where lm.year_id = target_year_id
        and lm.month >= from_month
      on conflict (month_id, category_id) do update
      set
        limit_entity_id = excluded.limit_entity_id,
        amount_cents = excluded.amount_cents,
        revision = excluded.revision,
        updated_at = applied_at;

    when 'ledger.limit.delete' then
      target_category_id := (payload->>'categoryId')::uuid;
      from_month := (payload->>'fromMonth')::integer;
      select lc.year_id, lc.kind
      into target_year_id, from_currency
      from public.ledger_categories lc
      where lc.id = target_category_id
        and lc.household_id = household_id;
      if not found or from_currency <> 'spending' then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_spending_category',
          'Limits apply only to a household spending category'
        );
      end if;

      select lml.limit_entity_id
      into existing_limit_entity_id
      from public.ledger_month_limits lml
      where lml.category_id = target_category_id
      order by (lml.limit_entity_id = target_category_id), lml.id
      limit 1;

      if found
         and existing_limit_entity_id <> entity_id
         and (
           existing_limit_entity_id <> target_category_id
           or exists (
             select 1
             from public.household_entity_revisions er
             where er.household_id = household_id
               and er.entity_type = 'ledger_limit'
               and er.entity_id = existing_limit_entity_id
           )
         )
      then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'limit_identity_conflict',
          'Category limits already use a different entity identity',
          jsonb_build_object(
            'existingLimitEntityId', existing_limit_entity_id
          )
        );
      end if;

      if existing_limit_entity_id = target_category_id
         and existing_limit_entity_id <> entity_id
      then
        update public.ledger_month_limits
        set
          limit_entity_id = entity_id,
          updated_at = applied_at
        where category_id = target_category_id;
      end if;

      select lml.amount_cents
      into prior_limit
      from public.ledger_month_limits lml
      join public.ledger_months lm on lm.id = lml.month_id
      where lml.category_id = target_category_id
        and lm.month < from_month
      order by lm.month desc
      limit 1;

      update public.ledger_month_limits lml
      set
        amount_cents = prior_limit,
        limit_entity_id = entity_id,
        revision = next_revision,
        updated_at = applied_at
      from public.ledger_months lm
      where lml.month_id = lm.id
        and lml.category_id = target_category_id
        and lm.year_id = target_year_id
        and lm.month >= from_month;
      change_kind := 'delete';

    when 'ledger.transaction.upsert' then
      target_year_id := (payload->>'yearId')::uuid;
      from_month := (payload->>'month')::integer;
      target_category_id := (payload->>'categoryId')::uuid;
      target_asset_id := (payload->>'assetId')::uuid;
      amount_cents := (payload->>'amountCents')::bigint;

      select lm.id
      into target_month_id
      from public.ledger_months lm
      join public.ledger_years ly on ly.id = lm.year_id
      where lm.year_id = target_year_id
        and lm.month = from_month
        and ly.household_id = household_id
        and extract(year from (payload->>'occurredAt')::timestamptz) =
          ly.year
        and extract(month from (payload->>'occurredAt')::timestamptz) =
          lm.month;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_transaction_month',
          'Transaction time must match its household Ledger month'
        );
      end if;

      if not exists (
        select 1
        from public.ledger_month_categories lmc
        join public.ledger_categories lc on lc.id = lmc.category_id
        where lmc.month_id = target_month_id
          and lmc.category_id = target_category_id
          and lmc.household_id = household_id
          and lc.kind = payload->>'kind'
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_transaction_category',
          'Transaction category is not active for the month and kind'
        );
      end if;

      select currency_code
      into from_currency
      from public.ledger_assets la
      where la.id = target_asset_id
        and la.household_id = household_id;
      if not found or from_currency <> 'CAD' then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'ledger_requires_cad_asset',
          'Ledger transactions require a household CAD Asset'
        );
      end if;

      select *
      into old_row
      from public.ledger_transactions lt
      where lt.id = entity_id
        and lt.household_id = household_id;

      if found then
        if old_row.trip_expense_id is not null then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'trip_linked_transaction',
            'Trip-linked Ledger rows are edited through the Trip expense'
          );
        end if;
        perform public.mobile_add_posting(
          household_id,
          old_row.asset_id,
          operation_id,
          'ledger_transaction',
          entity_id,
          'previous_reversal',
          case
            when old_row.kind = 'income'
              then -old_row.amount_cents
            else old_row.amount_cents
          end,
          applied_at
        );

        update public.ledger_transactions
        set
          year_id = target_year_id,
          month_id = target_month_id,
          category_id = target_category_id,
          asset_id = target_asset_id,
          kind = payload->>'kind',
          amount_cents = amount_cents,
          occurred_at = (payload->>'occurredAt')::timestamptz,
          description = payload->>'description',
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;
      else
        insert into public.ledger_transactions (
          id,
          household_id,
          year_id,
          month_id,
          category_id,
          asset_id,
          kind,
          amount_cents,
          occurred_at,
          description,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          target_year_id,
          target_month_id,
          target_category_id,
          target_asset_id,
          payload->>'kind',
          amount_cents,
          (payload->>'occurredAt')::timestamptz,
          payload->>'description',
          actor_id,
          next_revision
        );
      end if;

      perform public.mobile_add_posting(
        household_id,
        target_asset_id,
        operation_id,
        'ledger_transaction',
        entity_id,
        'current_effect',
        case
          when payload->>'kind' = 'income' then amount_cents
          else -amount_cents
        end,
        (payload->>'occurredAt')::timestamptz
      );

      current_balance := public.mobile_asset_balance(target_asset_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', target_asset_id,
          'balanceCents', current_balance
        );
      end if;

    when 'ledger.transaction.delete' then
      select *
      into old_row
      from public.ledger_transactions lt
      where lt.id = entity_id
        and lt.household_id = household_id;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'transaction_not_found',
          'Ledger transaction was not found'
        );
      end if;
      if old_row.trip_expense_id is not null then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'trip_linked_transaction',
          'Trip-linked Ledger rows are deleted through the Trip expense'
        );
      end if;

      perform public.mobile_add_posting(
        household_id,
        old_row.asset_id,
        operation_id,
        'ledger_transaction',
        entity_id,
        'delete_reversal',
        case
          when old_row.kind = 'income' then -old_row.amount_cents
          else old_row.amount_cents
        end,
        applied_at
      );
      delete from public.ledger_transactions where id = entity_id;
      current_balance := public.mobile_asset_balance(old_row.asset_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', old_row.asset_id,
          'balanceCents', current_balance
        );
      end if;
      deleted_entity := true;
      change_kind := 'delete';

    when 'ledger.transfer.upsert' then
      select currency_code
      into from_currency
      from public.ledger_assets la
      where la.id = (payload->>'fromAssetId')::uuid
        and la.household_id = household_id;
      select currency_code
      into to_currency
      from public.ledger_assets la
      where la.id = (payload->>'toAssetId')::uuid
        and la.household_id = household_id;
      if from_currency is null or to_currency is null then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_transfer_asset',
          'Transfer Assets must belong to the household'
        );
      end if;
      if from_currency <> to_currency then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'currency_mismatch',
          'Asset transfers require matching currencies'
        );
      end if;

      select *
      into old_row
      from public.ledger_transfers lt
      where lt.id = entity_id
        and lt.household_id = household_id;
      if found then
        previous_destination_id := old_row.to_asset_id;
        perform public.mobile_add_posting(
          household_id, old_row.from_asset_id, operation_id,
          'ledger_transfer', entity_id, 'previous_source_reversal',
          old_row.amount_cents, applied_at
        );
        perform public.mobile_add_posting(
          household_id, old_row.to_asset_id, operation_id,
          'ledger_transfer', entity_id, 'previous_destination_reversal',
          -old_row.amount_cents, applied_at
        );
        update public.ledger_transfers
        set
          from_asset_id = (payload->>'fromAssetId')::uuid,
          to_asset_id = (payload->>'toAssetId')::uuid,
          amount_cents = (payload->>'amountCents')::bigint,
          occurred_at = (payload->>'occurredAt')::timestamptz,
          note = case
            when payload->'note' = 'null'::jsonb then null
            else payload->>'note'
          end,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;
      else
        insert into public.ledger_transfers (
          id,
          household_id,
          from_asset_id,
          to_asset_id,
          amount_cents,
          occurred_at,
          note,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          (payload->>'fromAssetId')::uuid,
          (payload->>'toAssetId')::uuid,
          (payload->>'amountCents')::bigint,
          (payload->>'occurredAt')::timestamptz,
          case
            when payload->'note' = 'null'::jsonb then null
            else payload->>'note'
          end,
          actor_id,
          next_revision
        );
      end if;

      perform public.mobile_add_posting(
        household_id,
        (payload->>'fromAssetId')::uuid,
        operation_id,
        'ledger_transfer',
        entity_id,
        'source',
        -(payload->>'amountCents')::bigint,
        (payload->>'occurredAt')::timestamptz
      );
      perform public.mobile_add_posting(
        household_id,
        (payload->>'toAssetId')::uuid,
        operation_id,
        'ledger_transfer',
        entity_id,
        'destination',
        (payload->>'amountCents')::bigint,
        (payload->>'occurredAt')::timestamptz
      );

      if previous_destination_id is not null then
        current_balance := public.mobile_asset_balance(previous_destination_id);
      end if;
      if previous_destination_id is not null and current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', previous_destination_id,
          'balanceCents', current_balance
        );
      end if;
      if warning is null then
        current_balance := public.mobile_asset_balance(
          (payload->>'fromAssetId')::uuid
        );
        if current_balance < 0 then
          warning := jsonb_build_object(
            'code', 'negative_asset_balance',
            'assetId', (payload->>'fromAssetId')::uuid,
            'balanceCents', current_balance
          );
        end if;
      end if;

    when 'ledger.transfer.delete' then
      select *
      into old_row
      from public.ledger_transfers lt
      where lt.id = entity_id
        and lt.household_id = household_id;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'transfer_not_found', 'Asset transfer was not found'
        );
      end if;
      perform public.mobile_add_posting(
        household_id, old_row.from_asset_id, operation_id,
        'ledger_transfer', entity_id, 'delete_source_reversal',
        old_row.amount_cents, applied_at
      );
      perform public.mobile_add_posting(
        household_id, old_row.to_asset_id, operation_id,
        'ledger_transfer', entity_id, 'delete_destination_reversal',
        -old_row.amount_cents, applied_at
      );
      current_balance := public.mobile_asset_balance(old_row.to_asset_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', old_row.to_asset_id,
          'balanceCents', current_balance
        );
      end if;
      delete from public.ledger_transfers where id = entity_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'ledger.schedule.upsert' then
      select currency_code
      into from_currency
      from public.ledger_assets la
      where la.id = (payload->>'fromAssetId')::uuid
        and la.household_id = household_id;
      select currency_code
      into to_currency
      from public.ledger_assets la
      where la.id = (payload->>'toAssetId')::uuid
        and la.household_id = household_id;
      if from_currency is null or to_currency is null
         or from_currency <> to_currency then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'currency_mismatch',
          'Scheduled transfers require household Assets in one currency'
        );
      end if;

      if has_current and not current_entity.deleted then
        update public.ledger_transfer_schedules
        set
          from_asset_id = (payload->>'fromAssetId')::uuid,
          to_asset_id = (payload->>'toAssetId')::uuid,
          amount_cents = (payload->>'amountCents')::bigint,
          frequency = payload->>'frequency',
          starts_at = (payload->>'startsAt')::timestamptz,
          timezone = payload->>'timezone',
          active = (payload->>'active')::boolean,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id
          and ledger_transfer_schedules.household_id = household_id;
      else
        insert into public.ledger_transfer_schedules (
          id,
          household_id,
          from_asset_id,
          to_asset_id,
          amount_cents,
          frequency,
          starts_at,
          timezone,
          active,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          (payload->>'fromAssetId')::uuid,
          (payload->>'toAssetId')::uuid,
          (payload->>'amountCents')::bigint,
          payload->>'frequency',
          (payload->>'startsAt')::timestamptz,
          payload->>'timezone',
          (payload->>'active')::boolean,
          actor_id,
          next_revision
        );
      end if;

    when 'ledger.schedule.delete' then
      if exists (
        select 1
        from public.ledger_transfers lt
        where lt.schedule_id = entity_id
      ) then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'schedule_has_transfers',
          'Schedule with generated transfers cannot be deleted'
        );
      end if;
      delete from public.ledger_transfer_schedules
      where id = entity_id
        and ledger_transfer_schedules.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'note.upsert' then
      if has_current and not current_entity.deleted then
        update public.household_notes
        set
          title = payload->>'title',
          document = payload->'document',
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id and household_notes.household_id = household_id;
      else
        insert into public.household_notes (
          id, household_id, title, document, created_by, revision
        )
        values (
          entity_id,
          household_id,
          payload->>'title',
          payload->'document',
          actor_id,
          next_revision
        );
      end if;

    when 'note.delete' then
      delete from public.household_notes
      where id = entity_id and household_notes.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'trip.upsert' then
      if has_current and not current_entity.deleted then
        if exists (
          select 1
          from public.household_trips ht
          join public.trip_expenses te on te.trip_id = ht.id
          where ht.id = entity_id
            and ht.household_id = household_id
            and ht.destination_currency <> payload->>'destinationCurrency'
            and te.currency_code <> 'CAD'
        ) then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'trip_currency_locked',
            'Trip destination currency cannot change after foreign expenses'
          );
        end if;

        update public.household_trips
        set
          name = payload->>'name',
          destination = payload->>'destination',
          destination_timezone = payload->>'timezone',
          destination_currency = payload->>'destinationCurrency',
          start_date = (payload->>'startDate')::date,
          end_date = (payload->>'endDate')::date,
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id and household_trips.household_id = household_id;
      else
        insert into public.household_trips (
          id,
          household_id,
          name,
          destination,
          destination_timezone,
          destination_currency,
          start_date,
          end_date,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          payload->>'name',
          payload->>'destination',
          payload->>'timezone',
          payload->>'destinationCurrency',
          (payload->>'startDate')::date,
          (payload->>'endDate')::date,
          actor_id,
          next_revision
        );
      end if;

    when 'trip.delete' then
      for old_row in
        select *
        from public.trip_expenses te
        where te.trip_id = entity_id
          and te.household_id = household_id
      loop
        perform public.mobile_add_posting(
          household_id,
          old_row.asset_id,
          operation_id,
          'trip_delete',
          old_row.id,
          'expense_reversal',
          old_row.amount_cents,
          applied_at
        );

        perform public.mobile_record_cascade_deletion(
          household_id,
          'trip_expense',
          old_row.id,
          old_row.revision,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );

        if old_row.ledger_transaction_id is not null then
          select *
          into related_row
          from public.ledger_transactions lt
          where lt.id = old_row.ledger_transaction_id
            and lt.household_id = household_id;

          if found then
            perform public.mobile_record_cascade_deletion(
              household_id,
              'ledger_transaction',
              related_row.id,
              related_row.revision,
              operation_id,
              operation_type,
              entity_type,
              entity_id,
              applied_at
            );
          end if;
        end if;
      end loop;
      update public.trip_expenses
      set ledger_transaction_id = null
      where trip_id = entity_id;
      delete from public.household_trips
      where id = entity_id and household_trips.household_id = household_id;
      deleted_entity := true;
      change_kind := 'delete';

    when 'trip.expense.upsert' then
      target_trip_id := (payload->>'tripId')::uuid;
      target_asset_id := (payload->>'assetId')::uuid;
      expense_currency := payload->>'currency';
      amount_cents := (payload->>'amountCents')::bigint;

      select *
      into related_row
      from public.household_trips ht
      where ht.id = target_trip_id
        and ht.household_id = household_id;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'invalid_trip', 'Trip is not in the household'
        );
      end if;
      if expense_currency <> 'CAD'
         and expense_currency <> related_row.destination_currency then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'unsupported_trip_currency',
          'Expense must use CAD or the Trip destination currency'
        );
      end if;

      select currency_code
      into from_currency
      from public.ledger_assets la
      where la.id = target_asset_id
        and la.household_id = household_id;
      if from_currency is null or from_currency <> expense_currency then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'currency_mismatch',
          'Expense currency must match the Asset currency'
        );
      end if;

      select *
      into old_row
      from public.trip_expenses te
      where te.id = entity_id
        and te.household_id = household_id;
      if found then
        perform public.mobile_add_posting(
          household_id,
          old_row.asset_id,
          operation_id,
          'trip_expense',
          entity_id,
          'previous_reversal',
          old_row.amount_cents,
          applied_at
        );
        if old_row.ledger_transaction_id is not null then
          select *
          into related_row
          from public.ledger_transactions lt
          where lt.id = old_row.ledger_transaction_id
            and lt.household_id = household_id;

          if found then
            perform public.mobile_record_cascade_deletion(
              household_id,
              'ledger_transaction',
              related_row.id,
              related_row.revision,
              operation_id,
              operation_type,
              entity_type,
              entity_id,
              applied_at
            );
          end if;

          update public.trip_expenses
          set ledger_transaction_id = null
          where id = entity_id;
          delete from public.ledger_transactions
          where id = old_row.ledger_transaction_id;
        end if;

        update public.trip_expenses
        set
          trip_id = target_trip_id,
          asset_id = target_asset_id,
          amount_cents = amount_cents,
          currency_code = expense_currency,
          spent_at = (payload->>'spentAt')::timestamptz,
          description = payload->>'description',
          revision = next_revision,
          updated_at = applied_at
        where id = entity_id;
      else
        insert into public.trip_expenses (
          id,
          household_id,
          trip_id,
          asset_id,
          amount_cents,
          currency_code,
          spent_at,
          description,
          created_by,
          revision
        )
        values (
          entity_id,
          household_id,
          target_trip_id,
          target_asset_id,
          amount_cents,
          expense_currency,
          (payload->>'spentAt')::timestamptz,
          payload->>'description',
          actor_id,
          next_revision
        );
      end if;

      perform public.mobile_add_posting(
        household_id,
        target_asset_id,
        operation_id,
        'trip_expense',
        entity_id,
        'expense',
        -amount_cents,
        (payload->>'spentAt')::timestamptz
      );

      if expense_currency = 'CAD' then
        target_year := extract(
          year from (payload->>'spentAt')::timestamptz
        )::integer;
        from_month := extract(
          month from (payload->>'spentAt')::timestamptz
        )::integer;
        target_year_id := public.mobile_ensure_ledger_year(
          household_id,
          target_year,
          actor_id,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
        target_category_id := public.mobile_ensure_travel_category(
          household_id,
          target_year_id,
          actor_id,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
        select lm.id
        into target_month_id
        from public.ledger_months lm
        where lm.year_id = target_year_id and lm.month = from_month;

        generated_transaction_id := gen_random_uuid();
        insert into public.ledger_transactions (
          id,
          household_id,
          year_id,
          month_id,
          category_id,
          asset_id,
          kind,
          amount_cents,
          occurred_at,
          description,
          trip_expense_id,
          created_by,
          revision
        )
        values (
          generated_transaction_id,
          household_id,
          target_year_id,
          target_month_id,
          target_category_id,
          target_asset_id,
          'spending',
          amount_cents,
          (payload->>'spentAt')::timestamptz,
          payload->>'description',
          entity_id,
          actor_id,
          1
        );
        update public.trip_expenses
        set ledger_transaction_id = generated_transaction_id
        where id = entity_id;

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
          household_id,
          'ledger_transaction',
          generated_transaction_id,
          1,
          false,
          operation_id,
          operation_type,
          entity_type,
          entity_id,
          applied_at
        );
      end if;

      current_balance := public.mobile_asset_balance(target_asset_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', target_asset_id,
          'balanceCents', current_balance
        );
      end if;

    when 'trip.expense.delete' then
      select *
      into old_row
      from public.trip_expenses te
      where te.id = entity_id
        and te.household_id = household_id;
      if not found then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'trip_expense_not_found',
          'Trip expense was not found'
        );
      end if;
      perform public.mobile_add_posting(
        household_id,
        old_row.asset_id,
        operation_id,
        'trip_expense',
        entity_id,
        'delete_reversal',
        old_row.amount_cents,
        applied_at
      );
      if old_row.ledger_transaction_id is not null then
        select *
        into related_row
        from public.ledger_transactions lt
        where lt.id = old_row.ledger_transaction_id
          and lt.household_id = household_id;

        if found then
          perform public.mobile_record_cascade_deletion(
            household_id,
            'ledger_transaction',
            related_row.id,
            related_row.revision,
            operation_id,
            operation_type,
            entity_type,
            entity_id,
            applied_at
          );
        end if;

        update public.trip_expenses
        set ledger_transaction_id = null
        where id = entity_id;
        delete from public.ledger_transactions
        where id = old_row.ledger_transaction_id;
      end if;
      delete from public.trip_expenses where id = entity_id;
      current_balance := public.mobile_asset_balance(old_row.asset_id);
      if current_balance < 0 then
        warning := jsonb_build_object(
          'code', 'negative_asset_balance',
          'assetId', old_row.asset_id,
          'balanceCents', current_balance
        );
      end if;
      deleted_entity := true;
      change_kind := 'delete';

    when 'notification.read' then
      update public.notifications
      set
        read_at = (payload->>'readAt')::timestamptz,
        revision = next_revision,
        updated_at = applied_at
      where id = entity_id
        and notifications.household_id = household_id
        and recipient_user_id = actor_id;
      get diagnostics row_count = row_count;
      if row_count <> 1 then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'notification_not_owned',
          'Only the recipient can read a notification'
        );
      end if;
      change_kind := 'read';

    when 'settings.update' then
      if entity_id <> actor_id then
        return public.mobile_store_rejection(
          household_id, actor_id, device_id, local_sequence, operation_id,
          command_hash, 'settings_not_owned',
          'Settings can only be changed by their user'
        );
      end if;

      select *
      into old_row
      from public.profiles p
      where p.user_id = actor_id;
      if found then
        update public.profiles
        set
          display_name = case
            when payload ? 'displayName' then payload->>'displayName'
            else old_row.display_name
          end,
          appearance = case
            when payload ? 'appearance' then payload->>'appearance'
            else old_row.appearance
          end,
          notifications_enabled = case
            when payload ? 'notificationsEnabled'
              then (payload->>'notificationsEnabled')::boolean
            else old_row.notifications_enabled
          end,
          revision = next_revision,
          updated_at = applied_at
        where user_id = actor_id;
      else
        if not payload ? 'displayName' then
          return public.mobile_store_rejection(
            household_id, actor_id, device_id, local_sequence, operation_id,
            command_hash, 'display_name_required',
            'A first settings update requires displayName'
          );
        end if;
        insert into public.profiles (
          user_id,
          display_name,
          appearance,
          notifications_enabled,
          revision
        )
        values (
          actor_id,
          payload->>'displayName',
          coalesce(payload->>'appearance', 'system'),
          coalesce(
            (payload->>'notificationsEnabled')::boolean,
            true
          ),
          next_revision
        );
      end if;

    else
      raise internal_error using message = 'validated operation was not dispatched';
  end case;

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
    household_id,
    entity_type,
    entity_id,
    next_revision,
    deleted_entity,
    operation_id,
    operation_type,
    entity_type,
    entity_id,
    applied_at
  )
  on conflict on constraint household_entity_revisions_pkey do update
  set
    revision = excluded.revision,
    deleted = excluded.deleted,
    last_operation_id = excluded.last_operation_id,
    winner_type = excluded.winner_type,
    winner_entity_type = excluded.winner_entity_type,
    winner_entity_id = excluded.winner_entity_id,
    applied_at = excluded.applied_at;

  if deleted_entity then
    insert into public.household_tombstones (
      household_id,
      entity_type,
      entity_id,
      revision,
      operation_id,
      deleted_at
    )
    values (
      household_id,
      entity_type,
      entity_id,
      next_revision,
      operation_id,
      applied_at
    )
    on conflict on constraint
      household_tombstones_household_id_entity_type_entity_id_key
    do update
    set
      revision = excluded.revision,
      operation_id = excluded.operation_id,
      deleted_at = excluded.deleted_at;
  else
    delete from public.household_tombstones ht
    where ht.household_id = household_id
      and ht.entity_type = entity_type
      and ht.entity_id = entity_id;
  end if;

  select coalesce(max(operation_receipt.server_sequence), 0) + 1
  into server_sequence
  from public.operation_receipts operation_receipt
  where operation_receipt.household_id = household_id;

  result := jsonb_build_object(
    'status', 'applied',
    'operationId', operation_id,
    'serverSequence', server_sequence,
    'entityRevision', next_revision
  );
  if warning is not null then
    result := result || jsonb_build_object('warning', warning);
  end if;
  if details <> '{}'::jsonb then
    result := result || jsonb_build_object('details', details);
  end if;

  insert into public.operation_receipts (
    operation_id,
    household_id,
    actor_user_id,
    device_id,
    local_sequence,
    command_hash,
    server_sequence,
    status,
    result,
    created_at
  )
  values (
    operation_id,
    household_id,
    actor_id,
    device_id,
    local_sequence,
    command_hash,
    server_sequence,
    'applied',
    result,
    applied_at
  );

  insert into public.household_change_log (
    household_id,
    server_sequence,
    operation_id,
    operation_type,
    entity_type,
    entity_id,
    entity_revision,
    change_kind,
    changed_at
  )
  values (
    household_id,
    server_sequence,
    operation_id,
    operation_type,
    entity_type,
    entity_id,
    next_revision,
    change_kind,
    applied_at
  );

  return result;
end;
$$;
