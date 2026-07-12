-- Broadcast row changes for every app table so clients can keep their
-- React Query caches live (Phase 5). RLS still governs what each
-- subscriber may see for INSERT/UPDATE.
alter publication supabase_realtime add table
  pages,
  budget_categories,
  budget_entries,
  trip_itinerary_items,
  trip_bookings,
  trip_checklist_items,
  grocery_items,
  grocery_price_history;

-- Without this, DELETE events are silently dropped from page/household-
-- filtered subscriptions (verified live): the default replica identity
-- gives the old record only its primary key, so `page_id=eq.…` filters can
-- never match a delete. FULL puts the whole old row in the WAL so filters
-- apply to deletes too. Cost is negligible at this app's write volume;
-- the wider delete-event visibility only reaches this household's two
-- invited members.
alter table pages replica identity full;
alter table budget_categories replica identity full;
alter table budget_entries replica identity full;
alter table trip_itinerary_items replica identity full;
alter table trip_bookings replica identity full;
alter table trip_checklist_items replica identity full;
alter table grocery_items replica identity full;
alter table grocery_price_history replica identity full;
