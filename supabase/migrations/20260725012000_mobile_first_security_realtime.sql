-- Mobile clients may read household state through RLS. All writes are routed
-- through apply_household_operation; the earlier default-privilege migration
-- otherwise grants authenticated DML on every future public table.

alter table public.profiles enable row level security;
alter table public.household_invites enable row level security;
alter table public.ledger_assets enable row level security;
alter table public.asset_postings enable row level security;
alter table public.ledger_transfers enable row level security;
alter table public.ledger_transfer_schedules enable row level security;
alter table public.ledger_years enable row level security;
alter table public.ledger_months enable row level security;
alter table public.ledger_categories enable row level security;
alter table public.ledger_month_categories enable row level security;
alter table public.ledger_month_limits enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.household_notes enable row level security;
alter table public.household_grocery_lists enable row level security;
alter table public.household_grocery_items enable row level security;
alter table public.household_grocery_price_history enable row level security;
alter table public.calendar_event_reminders enable row level security;
alter table public.notifications enable row level security;
alter table public.household_trips enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.operation_receipts enable row level security;
alter table public.household_entity_revisions enable row level security;
alter table public.household_tombstones enable row level security;
alter table public.household_change_log enable row level security;

create policy "household peer profiles read"
  on public.profiles for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.household_members self_member
      join public.household_members peer_member
        on peer_member.household_id = self_member.household_id
      where self_member.user_id = auth.uid()
        and peer_member.user_id = profiles.user_id
    )
  );

create policy "household invites read"
  on public.household_invites for select
  using (public.is_household_member(household_id));
create policy "ledger assets read"
  on public.ledger_assets for select
  using (public.is_household_member(household_id));
create policy "asset postings read"
  on public.asset_postings for select
  using (public.is_household_member(household_id));
create policy "ledger transfers read"
  on public.ledger_transfers for select
  using (public.is_household_member(household_id));
create policy "ledger transfer schedules read"
  on public.ledger_transfer_schedules for select
  using (public.is_household_member(household_id));
create policy "ledger years read"
  on public.ledger_years for select
  using (public.is_household_member(household_id));
create policy "ledger months read"
  on public.ledger_months for select
  using (public.is_household_member(household_id));
create policy "ledger categories read"
  on public.ledger_categories for select
  using (public.is_household_member(household_id));
create policy "ledger month categories read"
  on public.ledger_month_categories for select
  using (public.is_household_member(household_id));
create policy "ledger month limits read"
  on public.ledger_month_limits for select
  using (public.is_household_member(household_id));
create policy "ledger transactions read"
  on public.ledger_transactions for select
  using (public.is_household_member(household_id));
create policy "household notes read"
  on public.household_notes for select
  using (public.is_household_member(household_id));
create policy "household grocery lists read"
  on public.household_grocery_lists for select
  using (public.is_household_member(household_id));
create policy "household grocery items read"
  on public.household_grocery_items for select
  using (public.is_household_member(household_id));
create policy "household grocery history read"
  on public.household_grocery_price_history for select
  using (public.is_household_member(household_id));
create policy "calendar reminders read"
  on public.calendar_event_reminders for select
  using (public.is_household_member(household_id));
create policy "recipient notifications read"
  on public.notifications for select
  using (
    public.is_household_member(household_id)
    and recipient_user_id = auth.uid()
  );
create policy "household trips read"
  on public.household_trips for select
  using (public.is_household_member(household_id));
create policy "trip expenses read"
  on public.trip_expenses for select
  using (public.is_household_member(household_id));
create policy "operation receipts read"
  on public.operation_receipts for select
  using (public.is_household_member(household_id));
create policy "entity revisions read"
  on public.household_entity_revisions for select
  using (public.is_household_member(household_id));
create policy "household tombstones read"
  on public.household_tombstones for select
  using (public.is_household_member(household_id));
create policy "household change log read"
  on public.household_change_log for select
  using (public.is_household_member(household_id));

drop policy "household rw" on public.calendar_events;
create policy "calendar events read"
  on public.calendar_events for select
  using (public.is_household_member(household_id));

revoke insert, update, delete, truncate on table
  public.profiles,
  public.household_invites,
  public.ledger_assets,
  public.asset_postings,
  public.ledger_transfers,
  public.ledger_transfer_schedules,
  public.ledger_years,
  public.ledger_months,
  public.ledger_categories,
  public.ledger_month_categories,
  public.ledger_month_limits,
  public.ledger_transactions,
  public.household_notes,
  public.household_grocery_lists,
  public.household_grocery_items,
  public.household_grocery_price_history,
  public.calendar_events,
  public.calendar_event_reminders,
  public.notifications,
  public.household_trips,
  public.trip_expenses,
  public.operation_receipts,
  public.household_entity_revisions,
  public.household_tombstones,
  public.household_change_log
from authenticated, anon;

revoke insert, update, delete, truncate on table
  public.households,
  public.household_members
from authenticated, anon;

grant select on table
  public.profiles,
  public.household_invites,
  public.ledger_assets,
  public.ledger_asset_balances,
  public.asset_postings,
  public.ledger_transfers,
  public.ledger_transfer_schedules,
  public.ledger_years,
  public.ledger_months,
  public.ledger_categories,
  public.ledger_month_categories,
  public.ledger_month_limits,
  public.ledger_transactions,
  public.household_notes,
  public.household_grocery_lists,
  public.household_grocery_items,
  public.household_grocery_price_history,
  public.calendar_events,
  public.calendar_event_reminders,
  public.notifications,
  public.household_trips,
  public.trip_expenses,
  public.operation_receipts,
  public.household_entity_revisions,
  public.household_tombstones,
  public.household_change_log
to authenticated, service_role;

revoke execute on function public.apply_household_operation(jsonb)
  from public, anon;
grant execute on function public.apply_household_operation(jsonb)
  to authenticated;

revoke execute on function public.mobile_json_keys_valid(jsonb, text[], text[])
  from public, anon, authenticated;
revoke execute on function public.mobile_json_is_uuid(jsonb)
  from public, anon, authenticated;
revoke execute on function public.mobile_json_is_integer(jsonb, bigint, bigint)
  from public, anon, authenticated;
revoke execute on function public.mobile_is_iso_instant(text)
  from public, anon, authenticated;
revoke execute on function public.mobile_is_iso_date(text)
  from public, anon, authenticated;
revoke execute on function public.mobile_note_node_valid(jsonb, text)
  from public, anon, authenticated;
revoke execute on function public.mobile_rejected_result(
  uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;
revoke execute on function public.mobile_store_rejection(
  uuid, uuid, uuid, bigint, uuid, bytea, text, text, jsonb, jsonb
) from public, anon, authenticated;
revoke execute on function public.mobile_asset_balance(uuid)
  from public, anon, authenticated;
revoke execute on function public.mobile_add_posting(
  uuid, uuid, uuid, text, uuid, text, bigint, timestamptz
) from public, anon, authenticated;
revoke execute on function public.mobile_record_cascade_deletion(
  uuid, text, uuid, bigint, uuid, text, text, uuid, timestamptz
) from public, anon, authenticated;
revoke execute on function public.mobile_record_cascade_update(
  uuid, text, uuid, bigint, uuid, text, text, uuid, timestamptz
) from public, anon, authenticated;
revoke execute on function public.mobile_ensure_ledger_year(
  uuid, integer, uuid, uuid, text, text, uuid, timestamptz
) from public, anon, authenticated;
revoke execute on function public.mobile_ensure_travel_category(
  uuid, uuid, uuid, uuid, text, text, uuid, timestamptz
) from public, anon, authenticated;
revoke execute on function public.mobile_expected_entity_type(text)
  from public, anon, authenticated;
revoke execute on function public.mobile_operation_payload_valid(text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.mobile_is_iso_currency_code(text)
  from public, anon, authenticated;
revoke execute on function public.mobile_is_iana_timezone(text)
  from public, anon, authenticated;
revoke execute on function public.mobile_register_calendar_event_revision()
  from public, anon, authenticated;

alter publication supabase_realtime add table
  public.ledger_assets,
  public.asset_postings,
  public.ledger_transfers,
  public.ledger_transfer_schedules,
  public.ledger_years,
  public.ledger_months,
  public.ledger_categories,
  public.ledger_month_categories,
  public.ledger_month_limits,
  public.ledger_transactions,
  public.household_notes,
  public.household_grocery_lists,
  public.household_grocery_items,
  public.household_grocery_price_history,
  public.calendar_event_reminders,
  public.notifications,
  public.household_trips,
  public.trip_expenses,
  public.household_tombstones,
  public.household_change_log;

alter table public.ledger_assets replica identity full;
alter table public.asset_postings replica identity full;
alter table public.ledger_transfers replica identity full;
alter table public.ledger_transfer_schedules replica identity full;
alter table public.ledger_years replica identity full;
alter table public.ledger_months replica identity full;
alter table public.ledger_categories replica identity full;
alter table public.ledger_month_categories replica identity full;
alter table public.ledger_month_limits replica identity full;
alter table public.ledger_transactions replica identity full;
alter table public.household_notes replica identity full;
alter table public.household_grocery_lists replica identity full;
alter table public.household_grocery_items replica identity full;
alter table public.household_grocery_price_history replica identity full;
alter table public.calendar_event_reminders replica identity full;
alter table public.notifications replica identity full;
alter table public.household_trips replica identity full;
alter table public.trip_expenses replica identity full;
alter table public.household_tombstones replica identity full;
alter table public.household_change_log replica identity full;
