-- Canonical Grocery purchase data and server-owned history semantics. Legacy
-- six-key web payloads remain valid; native canonical payloads add exact
-- quantity/total/occurrence data without rewriting any deployed migration.

alter table public.household_grocery_items
  add column purchase_quantity numeric,
  add column total_price_cents bigint,
  add column purchase_occurrence_id uuid;

update public.household_grocery_items
set
  purchase_quantity = case when unit_price_cents > 0 then 1 else null end,
  total_price_cents = case when unit_price_cents > 0 then unit_price_cents else null end,
  purchase_occurrence_id = case when checked then gen_random_uuid() else null end;

alter table public.household_grocery_items
  add constraint household_grocery_items_purchase_quantity_positive
    check (purchase_quantity is null or purchase_quantity > 0),
  add constraint household_grocery_items_total_price_positive
    check (
      total_price_cents is null
      or total_price_cents between 1 and 9007199254740991
    ),
  add constraint household_grocery_items_total_requires_quantity
    check (total_price_cents is null or purchase_quantity is not null),
  add constraint household_grocery_items_occurrence_matches_checked
    check (checked = (purchase_occurrence_id is not null));

create unique index household_grocery_items_purchase_occurrence_key
  on public.household_grocery_items(household_id, purchase_occurrence_id)
  where purchase_occurrence_id is not null;

alter table public.household_grocery_price_history
  add column store_name text,
  -- Deliberately no foreign key: list_id keeps its ON DELETE SET NULL live
  -- reference for joins, while source_list_id is an immutable purchase-time
  -- identity so two deleted lists never collapse into one history bucket.
  add column source_list_id uuid,
  add column source_item_id uuid,
  add column purchase_occurrence_id uuid,
  add column purchase_quantity numeric,
  add column total_price_cents bigint;

update public.household_grocery_price_history history
set
  store_name = coalesce(
    (
      select list.name
      from public.household_grocery_lists list
      where list.id = history.list_id
        and list.household_id = history.household_id
    ),
    'Unknown list'
  ),
  -- Rows whose list was already deleted have lost their provenance. Give each
  -- one a private identity rather than merging unrelated purchases together.
  source_list_id = coalesce(history.list_id, gen_random_uuid()),
  purchase_quantity = 1,
  total_price_cents = history.price_cents;

-- Existing history represented quantity one, so rows with the same legacy
-- unit price are exact-ratio duplicates. Keep the newest immutable snapshot.
with ranked_history as (
  select
    id,
    row_number() over (
      partition by
        household_id,
        item_name_normalized,
        source_list_id,
        store_name,
        price_cents
      order by recorded_at desc, id desc
    ) as duplicate_rank
  from public.household_grocery_price_history
)
delete from public.household_grocery_price_history history
using ranked_history ranked
where history.id = ranked.id
  and ranked.duplicate_rank > 1;

alter table public.household_grocery_price_history
  alter column store_name set not null,
  alter column source_list_id set not null,
  alter column purchase_quantity set default 1,
  alter column purchase_quantity set not null,
  alter column total_price_cents set not null,
  add constraint household_grocery_price_history_store_name_nonblank
    check (btrim(store_name) <> ''),
  add constraint household_grocery_price_history_purchase_quantity_positive
    check (purchase_quantity > 0),
  add constraint household_grocery_price_history_total_price_positive
    check (total_price_cents between 1 and 9007199254740991);

create unique index household_grocery_price_history_occurrence_key
  on public.household_grocery_price_history(
    household_id,
    purchase_occurrence_id
  )
  where purchase_occurrence_id is not null;

create index household_grocery_price_history_purchase_lookup_idx
  on public.household_grocery_price_history(
    household_id,
    item_name_normalized,
    source_list_id,
    store_name,
    recorded_at desc
  );

-- Append-only ledger of every purchase occurrence this household has ever
-- used. Exact-ratio merges displace an occurrence from the history row that
-- carried it, so history alone cannot prove an occurrence is unused; this
-- ledger can. Deliberately internal: no client role reads or writes it.
create table public.household_grocery_purchase_occurrences (
  household_id uuid not null references public.households(id) on delete cascade,
  purchase_occurrence_id uuid not null,
  first_recorded_at timestamptz not null default now(),
  primary key (household_id, purchase_occurrence_id)
);

alter table public.household_grocery_purchase_occurrences
  enable row level security;
revoke all on table public.household_grocery_purchase_occurrences
  from public, anon, authenticated;

create function public.mobile_grocery_occurrence_ledger_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  -- The household cascade deletes the parent row first, so a missing household
  -- is the one removal that cannot enable occurrence reuse.
  if tg_op = 'DELETE'
     and not exists (
       select 1
       from public.households household
       where household.id = old.household_id
     )
  then
    return old;
  end if;

  raise restrict_violation
    using message = 'grocery purchase occurrences are append-only';
end;
$$;

create trigger trg_mobile_grocery_occurrence_ledger_append_only
before update or delete on public.household_grocery_purchase_occurrences
for each row
execute function public.mobile_grocery_occurrence_ledger_append_only();

insert into public.household_grocery_purchase_occurrences (
  household_id,
  purchase_occurrence_id
)
select item.household_id, item.purchase_occurrence_id
from public.household_grocery_items item
where item.purchase_occurrence_id is not null
on conflict do nothing;

-- Extend only the Grocery branch while retaining all profile, notification,
-- Trip, and legacy validator composition beneath it.
alter function public.mobile_operation_payload_valid(text, jsonb)
  rename to mobile_operation_payload_valid_v3;

create function public.mobile_operation_payload_valid(
  operation_type text,
  payload jsonb
)
returns boolean
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  canonical_key_count integer;
  purchase_quantity numeric;
  total_price_cents bigint;
  unit_price_cents bigint;
begin
  if operation_type <> 'grocery.item.upsert' then
    return public.mobile_operation_payload_valid_v3(operation_type, payload);
  end if;

  if jsonb_typeof(payload) <> 'object'
     or not public.mobile_json_keys_valid(
       payload,
       array[
         'listId','name','quantity','checked','unitPriceCents','sortOrder'
       ],
       array[
         'purchaseQuantity','totalPriceCents','purchaseOccurrenceId'
       ]
     )
     or not public.mobile_json_is_uuid(payload->'listId')
     or jsonb_typeof(payload->'name') <> 'string'
     or btrim(payload->>'name') = ''
     or not (
       payload->'quantity' = 'null'::jsonb
       or jsonb_typeof(payload->'quantity') = 'string'
     )
     or jsonb_typeof(payload->'checked') <> 'boolean'
     or not (
       payload->'unitPriceCents' = 'null'::jsonb
       or public.mobile_json_is_integer(
         payload->'unitPriceCents', 0, 9007199254740991
       )
     )
     or not public.mobile_json_is_integer(
       payload->'sortOrder', -2147483648, 2147483647
     )
  then
    return false;
  end if;

  canonical_key_count :=
    (payload ? 'purchaseQuantity')::integer
    + (payload ? 'totalPriceCents')::integer
    + (payload ? 'purchaseOccurrenceId')::integer;

  if canonical_key_count = 0 then
    return true;
  end if;
  if canonical_key_count <> 3 then
    return false;
  end if;

  if not (
    payload->'purchaseQuantity' = 'null'::jsonb
    or (
      jsonb_typeof(payload->'purchaseQuantity') = 'number'
      and (payload->>'purchaseQuantity')::numeric > 0
    )
  )
  or not (
    payload->'totalPriceCents' = 'null'::jsonb
    or public.mobile_json_is_integer(
      payload->'totalPriceCents', 1, 9007199254740991
    )
  )
  or not (
    payload->'purchaseOccurrenceId' = 'null'::jsonb
    or public.mobile_json_is_uuid(payload->'purchaseOccurrenceId')
  )
  then
    return false;
  end if;

  if (payload->>'checked')::boolean
       <> (payload->'purchaseOccurrenceId' <> 'null'::jsonb)
  then
    return false;
  end if;

  if payload->'totalPriceCents' = 'null'::jsonb then
    return payload->'unitPriceCents' = 'null'::jsonb;
  end if;
  if payload->'purchaseQuantity' = 'null'::jsonb
     or payload->'unitPriceCents' = 'null'::jsonb
  then
    return false;
  end if;

  purchase_quantity := (payload->>'purchaseQuantity')::numeric;
  total_price_cents := (payload->>'totalPriceCents')::bigint;
  unit_price_cents := (payload->>'unitPriceCents')::bigint;
  return unit_price_cents > 0
    and unit_price_cents::numeric
      = round(total_price_cents::numeric / purchase_quantity);
end;
$$;

-- Upsert one purchase occurrence into its exact-ratio bucket. An occurrence
-- edit keeps its row and purchase date; a later occurrence in the same bucket
-- advances the existing row. Household locking in the caller serializes this.
create function public.mobile_upsert_grocery_purchase_history(
  target_household_id uuid,
  target_list_id uuid,
  target_store_name text,
  target_item_id uuid,
  target_item_name text,
  target_purchase_quantity numeric,
  target_total_price_cents bigint,
  target_purchase_occurrence_id uuid,
  target_recorded_by uuid,
  target_recorded_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  normalized_name text := lower(btrim(target_item_name));
  rounded_unit_price bigint := round(
    target_total_price_cents::numeric / target_purchase_quantity
  )::bigint;
  occurrence_history public.household_grocery_price_history%rowtype;
  collision_history public.household_grocery_price_history%rowtype;
  occurrence_found boolean := false;
  collision_found boolean := false;
  bucket_list_id uuid := target_list_id;
  bucket_store_name text := target_store_name;
begin
  if target_purchase_occurrence_id is not null then
    select *
    into occurrence_history
    from public.household_grocery_price_history history
    where history.household_id = target_household_id
      and history.purchase_occurrence_id = target_purchase_occurrence_id
    for update;
    occurrence_found := found;
  end if;

  if occurrence_found then
    -- Store identity is a purchase-time snapshot and never follows later list
    -- moves or renames while the same occurrence is edited. source_list_id is
    -- immutable, so deleting the list cannot merge this bucket into another.
    bucket_list_id := occurrence_history.source_list_id;
    bucket_store_name := occurrence_history.store_name;
  end if;

  select *
  into collision_history
  from public.household_grocery_price_history history
  where history.household_id = target_household_id
    and history.item_name_normalized = normalized_name
    and history.source_list_id = bucket_list_id
    and history.store_name = bucket_store_name
    and history.total_price_cents::numeric * target_purchase_quantity
      = target_total_price_cents::numeric * history.purchase_quantity
    and (not occurrence_found or history.id <> occurrence_history.id)
  order by history.recorded_at desc, history.id desc
  limit 1
  for update;
  collision_found := found;

  if occurrence_found then
    if collision_found then
      delete from public.household_grocery_price_history history
      where history.id = collision_history.id;
    end if;

    update public.household_grocery_price_history history
    set
      item_name = target_item_name,
      item_name_normalized = normalized_name,
      price_cents = rounded_unit_price,
      recorded_by = target_recorded_by,
      recorded_at = target_recorded_at,
      source_item_id = target_item_id,
      purchase_quantity = target_purchase_quantity,
      total_price_cents = target_total_price_cents
    where history.id = occurrence_history.id;
    return;
  end if;

  if collision_found then
    if target_recorded_at >= collision_history.recorded_at then
      update public.household_grocery_price_history history
      set
        item_name = target_item_name,
        price_cents = rounded_unit_price,
        recorded_by = target_recorded_by,
        recorded_at = target_recorded_at,
        source_item_id = target_item_id,
        purchase_occurrence_id = target_purchase_occurrence_id,
        purchase_quantity = target_purchase_quantity,
        total_price_cents = target_total_price_cents
      where history.id = collision_history.id;
    end if;
    return;
  end if;

  insert into public.household_grocery_price_history (
    household_id,
    list_id,
    source_list_id,
    item_name,
    item_name_normalized,
    price_cents,
    recorded_by,
    recorded_at,
    store_name,
    source_item_id,
    purchase_occurrence_id,
    purchase_quantity,
    total_price_cents
  )
  values (
    target_household_id,
    target_list_id,
    target_list_id,
    target_item_name,
    normalized_name,
    rounded_unit_price,
    target_recorded_by,
    target_recorded_at,
    target_store_name,
    target_item_id,
    target_purchase_occurrence_id,
    target_purchase_quantity,
    target_total_price_cents
  );
end;
$$;

create function public.mobile_apply_grocery_item_upsert(command jsonb)
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
  next_revision bigint;
  server_sequence bigint;
  command_hash bytea;
  applied_at timestamptz := clock_timestamp();
  receipt public.operation_receipts%rowtype;
  current_entity public.household_entity_revisions%rowtype;
  old_item public.household_grocery_items%rowtype;
  has_current boolean := false;
  has_old_item boolean := false;
  result jsonb;
  target_list_id uuid;
  store_name text;
  canonical_payload boolean;
  purchase_quantity numeric;
  total_price_cents bigint;
  purchase_occurrence_id uuid;
  item_checked_at timestamptz;
  should_record_history boolean := false;
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
    command->'localSequence', 0, 9007199254740991
  ) then
    raise invalid_parameter_value
      using message = 'localSequence must be a nonnegative safe integer';
  end if;
  local_sequence := (command->>'localSequence')::bigint;
  if not (
    command->'baseRevision' = 'null'::jsonb
    or public.mobile_json_is_integer(
      command->'baseRevision', 1, 9007199254740991
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
    from public.household_members member
    where member.household_id = household_id
      and member.user_id = actor_id
  ) then
    raise insufficient_privilege
      using message = 'caller is not a member of the household';
  end if;

  perform 1
  from public.households household
  where household.id = household_id
  for update;

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
       or receipt.command_hash <> command_hash
    then
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
      household_id, actor_id, device_id, local_sequence, operation_id,
      command_hash, 'invalid_command',
      'Command has missing or unexpected keys'
    );
  end if;
  if not public.mobile_json_is_integer(command->'schemaVersion', 1, 1) then
    return public.mobile_store_rejection(
      household_id, actor_id, device_id, local_sequence, operation_id,
      command_hash, 'unsupported_schema_version',
      'Unsupported operation schema version'
    );
  end if;
  if operation_type <> 'grocery.item.upsert' then
    return public.mobile_store_rejection(
      household_id, actor_id, device_id, local_sequence, operation_id,
      command_hash, 'unsupported_operation',
      'Unsupported operation type'
    );
  end if;
  if entity_type <> 'grocery_item' then
    return public.mobile_store_rejection(
      household_id, actor_id, device_id, local_sequence, operation_id,
      command_hash, 'entity_type_mismatch',
      'Entity type does not match operation type',
      jsonb_build_object('expectedEntityType', 'grocery_item')
    );
  end if;
  if not public.mobile_operation_payload_valid(operation_type, payload) then
    return public.mobile_store_rejection(
      household_id, actor_id, device_id, local_sequence, operation_id,
      command_hash, 'invalid_payload',
      'Operation payload is invalid for its type'
    );
  end if;

  select *
  into current_entity
  from public.household_entity_revisions entity_revision
  where entity_revision.household_id = household_id
    and entity_revision.entity_type = entity_type
    and entity_revision.entity_id = entity_id
  for update;
  has_current := found;

  if not has_current and base_revision is not null then
    return public.mobile_store_rejection(
      household_id, actor_id, device_id, local_sequence, operation_id,
      command_hash, 'entity_not_found',
      'The entity does not exist at the supplied revision'
    );
  end if;
  if has_current
     and base_revision is distinct from current_entity.revision
  then
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
      operation_id, household_id, actor_user_id, device_id, local_sequence,
      command_hash, status, result
    )
    values (
      operation_id, household_id, actor_id, device_id, local_sequence,
      command_hash, 'conflict', result
    );
    return result;
  end if;

  target_list_id := (payload->>'listId')::uuid;
  select list.name
  into store_name
  from public.household_grocery_lists list
  where list.id = target_list_id
    and list.household_id = household_id
  for key share;
  if not found then
    return public.mobile_store_rejection(
      household_id, actor_id, device_id, local_sequence, operation_id,
      command_hash, 'invalid_list',
      'Grocery list is not in the household'
    );
  end if;

  select *
  into old_item
  from public.household_grocery_items item
  where item.id = entity_id
    and item.household_id = household_id
  for update;
  has_old_item := found;

  -- The item primary key is global, so a base-null command carrying another
  -- household's item UUID would otherwise reach a raw 23505 and bypass durable
  -- rejection and receipt handling entirely.
  if not has_old_item
     and exists (
       select 1
       from public.household_grocery_items item
       where item.id = entity_id
     )
  then
    return public.mobile_store_rejection(
      household_id, actor_id, device_id, local_sequence, operation_id,
      command_hash, 'entity_owned_by_other_household',
      'Entity ID already belongs to another household'
    );
  end if;

  canonical_payload := payload ? 'purchaseQuantity';
  if canonical_payload then
    purchase_quantity := case
      when payload->'purchaseQuantity' = 'null'::jsonb then null
      else (payload->>'purchaseQuantity')::numeric
    end;
    total_price_cents := case
      when payload->'totalPriceCents' = 'null'::jsonb then null
      else (payload->>'totalPriceCents')::bigint
    end;
    purchase_occurrence_id := case
      when payload->'purchaseOccurrenceId' = 'null'::jsonb then null
      else (payload->>'purchaseOccurrenceId')::uuid
    end;

    if has_old_item and old_item.checked
       and (payload->>'checked')::boolean
       and purchase_occurrence_id <> old_item.purchase_occurrence_id
    then
      return public.mobile_store_rejection(
        household_id, actor_id, device_id, local_sequence, operation_id,
        command_hash, 'purchase_occurrence_changed',
        'A checked purchase occurrence cannot change before unchecking'
      );
    end if;
    -- Consult the append-only ledger, not history: an exact-ratio merge can
    -- displace an occurrence from the row that carried it, and a displaced
    -- occurrence must still never be reusable.
    if (not has_old_item or not old_item.checked)
       and (payload->>'checked')::boolean
       and exists (
         select 1
         from public.household_grocery_purchase_occurrences ledger
         where ledger.household_id = household_id
           and ledger.purchase_occurrence_id = purchase_occurrence_id
       )
    then
      return public.mobile_store_rejection(
        household_id, actor_id, device_id, local_sequence, operation_id,
        command_hash, 'purchase_occurrence_reused',
        'A rechecked item requires a new purchase occurrence'
      );
    end if;

    -- Clearing the price of a purchase that is already recorded would leave a
    -- history row nothing can correct, so the command is rejected instead.
    if has_old_item and old_item.checked
       and (payload->>'checked')::boolean
       and purchase_occurrence_id = old_item.purchase_occurrence_id
       and total_price_cents is null
       and exists (
         select 1
         from public.household_grocery_price_history history
         where history.household_id = household_id
           and history.purchase_occurrence_id = purchase_occurrence_id
       )
    then
      return public.mobile_store_rejection(
        household_id, actor_id, device_id, local_sequence, operation_id,
        command_hash, 'purchase_price_cleared',
        'A recorded purchase price cannot be cleared while it stays checked'
      );
    end if;
  else
    purchase_quantity := case
      when payload->'unitPriceCents' <> 'null'::jsonb
        and (payload->>'unitPriceCents')::bigint > 0 then 1
      else null
    end;
    total_price_cents := case
      when payload->'unitPriceCents' <> 'null'::jsonb
        and (payload->>'unitPriceCents')::bigint > 0
        then (payload->>'unitPriceCents')::bigint
      else null
    end;
    purchase_occurrence_id := case
      when not (payload->>'checked')::boolean then null
      when has_old_item and old_item.checked
        then old_item.purchase_occurrence_id
      else gen_random_uuid()
    end;
  end if;

  if purchase_occurrence_id is not null then
    insert into public.household_grocery_purchase_occurrences (
      household_id,
      purchase_occurrence_id
    )
    values (household_id, purchase_occurrence_id)
    on conflict on constraint household_grocery_purchase_occurrences_pkey
      do nothing;
  end if;

  next_revision := case
    when has_current then current_entity.revision + 1
    else 1
  end;

  if has_old_item then
    update public.household_grocery_items item
    set
      list_id = target_list_id,
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
      purchase_quantity = purchase_quantity,
      total_price_cents = total_price_cents,
      purchase_occurrence_id = purchase_occurrence_id,
      sort_order = (payload->>'sortOrder')::integer,
      revision = next_revision,
      updated_at = applied_at
    where item.id = entity_id;
  else
    insert into public.household_grocery_items (
      id, household_id, list_id, name, quantity, checked, unit_price_cents,
      purchase_quantity, total_price_cents, purchase_occurrence_id,
      sort_order, created_by, revision
    )
    values (
      entity_id,
      household_id,
      target_list_id,
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
      purchase_quantity,
      total_price_cents,
      purchase_occurrence_id,
      (payload->>'sortOrder')::integer,
      actor_id,
      next_revision
    );
  end if;

  select item.checked_at
  into item_checked_at
  from public.household_grocery_items item
  where item.id = entity_id;

  -- Price history records purchases, never merely entered prices, so both the
  -- canonical and the legacy six-key payload gate on the checked state. A
  -- repeated write for the same occurrence corrects that occurrence's row.
  should_record_history := (payload->>'checked')::boolean
    and total_price_cents is not null;

  if should_record_history then
    perform public.mobile_upsert_grocery_purchase_history(
      household_id,
      target_list_id,
      store_name,
      entity_id,
      payload->>'name',
      purchase_quantity,
      total_price_cents,
      purchase_occurrence_id,
      actor_id,
      coalesce(item_checked_at, applied_at)
    );
  end if;

  insert into public.household_entity_revisions (
    household_id, entity_type, entity_id, revision, deleted,
    last_operation_id, winner_type, winner_entity_type, winner_entity_id,
    applied_at
  )
  values (
    household_id, entity_type, entity_id, next_revision, false,
    operation_id, operation_type, entity_type, entity_id, applied_at
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

  delete from public.household_tombstones tombstone
  where tombstone.household_id = household_id
    and tombstone.entity_type = entity_type
    and tombstone.entity_id = entity_id;

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
    entity_id, next_revision, 'upsert', applied_at
  );

  return result;
end;
$$;

-- Correct the earlier profile wrapper in-place through this forward migration:
-- a duplicate receipt proves its side effects already committed, so replay is
-- a true no-op and cannot restore stale preferences over a newer revision.
create or replace function public.apply_household_operation_v3(command jsonb)
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

  result := public.apply_household_operation_v2(command);

  if result->>'status' = 'applied' then
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

alter function public.apply_household_operation(jsonb)
  rename to apply_household_operation_v4;

create function public.apply_household_operation(command jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if command->>'type' = 'grocery.item.upsert' then
    return public.mobile_apply_grocery_item_upsert(command);
  end if;
  return public.apply_household_operation_v4(command);
end;
$$;

revoke execute on function public.mobile_operation_payload_valid_v3(text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.mobile_operation_payload_valid(text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.mobile_valid_navigation(jsonb)
  from public, anon, authenticated;
-- The notification-aware wrapper introduced in 20260813020000 was created
-- without revoking the default PUBLIC execute the older version had lost.
revoke execute on function public.mobile_expected_entity_type(text)
  from public, anon, authenticated;
revoke execute on function
  public.mobile_grocery_occurrence_ledger_append_only()
  from public, anon, authenticated;
revoke execute on function public.mobile_upsert_grocery_purchase_history(
  uuid, uuid, text, uuid, text, numeric, bigint, uuid, uuid, timestamptz
) from public, anon, authenticated;
revoke execute on function public.mobile_apply_grocery_item_upsert(jsonb)
  from public, anon, authenticated;
revoke execute on function public.apply_household_operation_v3(jsonb)
  from public, anon, authenticated;
revoke execute on function public.apply_household_operation_v4(jsonb)
  from public, anon, authenticated;
revoke execute on function public.apply_household_operation(jsonb)
  from public, anon;
grant execute on function public.apply_household_operation(jsonb)
  to authenticated, service_role;
