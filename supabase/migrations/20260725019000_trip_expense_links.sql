-- Add optional Trip-expense links without invalidating clients that still send
-- the original expense payload. The wrapper keeps one authoritative operation
-- transaction while delegating every existing operation to the proven RPC.

alter table public.trip_expenses
  add column if not exists itinerary_entry_id uuid
    references public.trip_itinerary_entries(id) on delete set null,
  add column if not exists booking_entry_id uuid
    references public.trip_booking_entries(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trip_expenses'::regclass
      and conname = 'trip_expenses_single_activity_link'
  ) then
    alter table public.trip_expenses
      add constraint trip_expenses_single_activity_link
      check (num_nonnulls(itinerary_entry_id, booking_entry_id) <= 1);
  end if;
end;
$$;

alter function public.apply_household_operation(jsonb)
  rename to apply_household_operation_v1;

create function public.apply_household_operation(command jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  operation_type text := command->>'type';
  command_operation_id text := command->>'operationId';
  target_household_id uuid;
  target_trip_id uuid;
  itinerary_id uuid;
  booking_id uuid;
  delegated_command jsonb := command;
  result jsonb;
begin
  if operation_type = 'trip.expense.upsert' then
    if not public.mobile_json_is_uuid(command->'operationId')
       or not public.mobile_json_is_uuid(command->'householdId')
       or not public.mobile_json_is_uuid(command->'payload'->'tripId')
    then
      return jsonb_build_object(
        'status', 'rejected',
        'operationId', coalesce(command_operation_id, gen_random_uuid()::text),
        'code', 'invalid_payload',
        'reason', 'Trip expense links require valid operation, household, and Trip identifiers',
        'details', '{}'::jsonb,
        'warnings', '[]'::jsonb
      );
    end if;

    target_household_id := (command->>'householdId')::uuid;
    target_trip_id := (command->'payload'->>'tripId')::uuid;

    if auth.uid() is null
       or not exists (
         select 1 from public.household_members hm
         where hm.household_id = target_household_id
           and hm.user_id = auth.uid()
       )
    then
      raise insufficient_privilege
        using message = 'caller is not a member of the household';
    end if;

    if coalesce(command->'payload'->'itineraryEntryId', 'null'::jsonb)
         <> 'null'::jsonb
    then
      if not public.mobile_json_is_uuid(
        command->'payload'->'itineraryEntryId'
      ) then
        return jsonb_build_object(
          'status', 'rejected', 'operationId', command_operation_id,
          'code', 'invalid_payload',
          'reason', 'The linked Itinerary identifier is invalid',
          'details', '{}'::jsonb, 'warnings', '[]'::jsonb
        );
      end if;
      itinerary_id := (command->'payload'->>'itineraryEntryId')::uuid;
    end if;

    if coalesce(command->'payload'->'bookingEntryId', 'null'::jsonb)
         <> 'null'::jsonb
    then
      if not public.mobile_json_is_uuid(command->'payload'->'bookingEntryId') then
        return jsonb_build_object(
          'status', 'rejected', 'operationId', command_operation_id,
          'code', 'invalid_payload',
          'reason', 'The linked Booking identifier is invalid',
          'details', '{}'::jsonb, 'warnings', '[]'::jsonb
        );
      end if;
      booking_id := (command->'payload'->>'bookingEntryId')::uuid;
    end if;

    if itinerary_id is not null and booking_id is not null then
      return jsonb_build_object(
        'status', 'rejected', 'operationId', command_operation_id,
        'code', 'invalid_payload',
        'reason', 'A Trip expense can link to only one activity',
        'details', '{}'::jsonb, 'warnings', '[]'::jsonb
      );
    end if;

    if itinerary_id is not null
       and not exists (
         select 1 from public.trip_itinerary_entries tie
         where tie.id = itinerary_id
           and tie.trip_id = target_trip_id
           and tie.household_id = target_household_id
       )
    then
      return jsonb_build_object(
        'status', 'rejected', 'operationId', command_operation_id,
        'code', 'invalid_trip_expense_link',
        'reason', 'Linked itinerary activity is not in this Trip',
        'details', '{}'::jsonb, 'warnings', '[]'::jsonb
      );
    end if;

    if booking_id is not null
       and not exists (
         select 1 from public.trip_booking_entries tbe
         where tbe.id = booking_id
           and tbe.trip_id = target_trip_id
           and tbe.household_id = target_household_id
       )
    then
      return jsonb_build_object(
        'status', 'rejected', 'operationId', command_operation_id,
        'code', 'invalid_trip_expense_link',
        'reason', 'Linked booking is not in this Trip',
        'details', '{}'::jsonb, 'warnings', '[]'::jsonb
      );
    end if;

    delegated_command := jsonb_set(
      command,
      '{payload}',
      (command->'payload') - 'itineraryEntryId' - 'bookingEntryId'
    );
  end if;

  result := public.apply_household_operation_v1(delegated_command);

  if operation_type = 'trip.expense.upsert'
     and result->>'status' in ('applied', 'duplicate')
  then
    update public.trip_expenses
    set
      itinerary_entry_id = itinerary_id,
      booking_entry_id = booking_id
    where id = (command->>'entityId')::uuid
      and trip_id = target_trip_id
      and trip_expenses.household_id = target_household_id;
  elsif operation_type = 'trip.expense.delete'
        and result->>'status' in ('applied', 'duplicate')
  then
    -- Repairs the tombstone/change kind for databases that applied the first
    -- Trip-content migration before its missing delete flags were corrected.
    update public.household_entity_revisions
    set deleted = true
    where last_operation_id = (command->>'operationId')::uuid
      and entity_type = 'trip_expense';
    update public.household_change_log
    set change_kind = 'delete'
    where operation_id = (command->>'operationId')::uuid
      and entity_type = 'trip_expense';
  end if;

  return result;
end;
$$;

revoke execute on function public.apply_household_operation_v1(jsonb)
  from public, anon, authenticated;
revoke execute on function public.apply_household_operation(jsonb)
  from public, anon;
grant execute on function public.apply_household_operation(jsonb)
  to authenticated, service_role;
