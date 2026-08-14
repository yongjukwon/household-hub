-- A household cascade deletes Calendar events after the parent household is
-- no longer visible to the trigger. Those deletes have no surviving activity
-- recipients, so skip the transient snapshot instead of violating its FK.

create or replace function public.mobile_snapshot_deleted_calendar_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.households household where household.id = old.household_id
  ) then
    return old;
  end if;

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

revoke execute on function public.mobile_snapshot_deleted_calendar_event()
  from public, anon, authenticated;
