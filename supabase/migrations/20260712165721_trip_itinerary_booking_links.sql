-- Reminder.md refinements for the Trip template.
--
-- Itinerary items get an optional open/close time pair (replacing the single
-- start_time — a place is "open 09:00–17:00", not just "starts at 09:00") plus
-- optional ticket and map links. Bookings get an optional confirmation link
-- alongside the existing confirmation number.
--
-- No data preservation: this is a pre-launch dev database.

alter table trip_itinerary_items
  drop column start_time,
  add column open_time time,
  add column close_time time,
  add column ticket_url text,
  add column map_url text,
  add constraint trip_itinerary_items_time_order
    check (open_time is null or close_time is null or close_time >= open_time);

alter table trip_bookings
  add column confirmation_url text;
