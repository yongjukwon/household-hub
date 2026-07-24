-- Calendar: a household-wide flat list of events (no pages), modeled on
-- savings_sources. Each event is attributed to one member (owner_id) or is
-- shared (owner_id null), with simple whole-series recurrence. Reminders are
-- intentionally out of scope for v1.

create type calendar_recurrence_freq as enum
  ('none', 'daily', 'weekly', 'monthly', 'yearly');

-- Root-level table (like savings_sources / pages): household_id is
-- client-supplied from useHousehold(), validated by the RLS with-check since
-- there is no parent to derive it from.
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  -- null = shared household event; otherwise the member whose event it is.
  -- If that member is ever removed, their events fall back to shared.
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  title text not null check (btrim(title) <> ''),
  note text,
  all_day boolean not null default false,
  start_at timestamptz not null,
  end_at timestamptz not null,
  recurrence_freq calendar_recurrence_freq not null default 'none',
  -- inclusive last date a recurrence may land on; null = no end.
  recurrence_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at >= start_at)
);

-- owner_id, when set, must belong to the same household — otherwise an event
-- could be attributed to a user outside the household. (household_id itself is
-- guarded by the RLS with-check; this guards the second user reference.)
create or replace function validate_calendar_event_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_id is not null
     and not exists (
       select 1 from household_members hm
       where hm.household_id = new.household_id
         and hm.user_id = new.owner_id
     ) then
    raise foreign_key_violation
      using message = 'calendar event owner is not a member of the household';
  end if;
  return new;
end;
$$;

create trigger trg_calendar_events_validate_owner
  before insert or update of owner_id, household_id on calendar_events
  for each row execute function validate_calendar_event_owner();

-- Attribution of who logged the event (reuses the pinned-search_path helper).
create trigger trg_calendar_events_created_by
  before insert on calendar_events
  for each row execute function set_created_by();

create trigger trg_calendar_events_updated_at
  before update on calendar_events
  for each row execute function set_updated_at();

alter table calendar_events enable row level security;

create policy "household rw" on calendar_events for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create index calendar_events_household_start_idx
  on calendar_events (household_id, start_at);

alter publication supabase_realtime add table calendar_events;
alter table calendar_events replica identity full;
