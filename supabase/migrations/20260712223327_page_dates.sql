-- Optional date range for a page. Used by Trip pages (the trip's period): the
-- itinerary date picker constrains item dates to these days. Nullable and
-- generic on `pages` so it loads with the page (usePage selects *); only trip
-- pages set it today.

alter table pages
  add column start_date date,
  add column end_date date,
  add constraint pages_date_range
    check (start_date is null or end_date is null or end_date >= start_date);
