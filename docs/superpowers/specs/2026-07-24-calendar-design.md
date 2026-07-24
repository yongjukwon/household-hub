# Calendar — Design Spec (v1)

**Date:** 2026-07-24
**Status:** Approved, implementing
**App:** Web PWA (`household-hub`). Native (React Native) port happens later with
the rest of the RN migration.

## Context

Household Hub is a shared budget/trips/groceries/notes/savings PWA for two
people (a couple). They want a **shared calendar** so each partner can log and
see events — their own, their partner's, or shared. It follows the app's
existing conventions exactly (flat household feature like Savings, RLS tenant
scoping, realtime sync, offline outbox), so it slots in without new
architecture. This spec covers **v1: viewing and logging events**; reminders
are explicitly deferred.

## Scope

**In scope:**
- A new top-level `/calendar` destination (like Savings — a flat household
  feature, not a page-under-section).
- Event types: timed, all-day, multi-day.
- Simple recurrence: `daily | weekly | monthly | yearly` with an optional
  "until" date; **whole-series** edits/deletes.
- Attribution: **Yours / Partner's / Shared**, color-coded, either partner can
  add an event for either person or shared.
- Month-grid view with colored dots + tap-a-day to see that day's events.
- Add/edit/delete via a dialog. Offline writes + realtime sync.

**Explicitly deferred (noted, not built):**
- Reminders / notifications (lands with the native-app push work).
- Multi-weekday weekly ("every Tue & Thu" in one event).
- Per-occurrence exceptions ("skip just this week" without touching the series).
- Week/agenda views.

## Data model

One table, `calendar_events`, mirroring the Savings root-table pattern
(`supabase/migrations/20260713035053_savings.sql`). Follow the
`supabase-rls-tenant-scoping` skill.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `household_id` | uuid not null → households | tenant; client-supplied from `useHousehold()`, validated by RLS with-check (root table, no parent to derive from) |
| `owner_id` | uuid **null** → auth.users | **null = Shared**; else the member whose event it is |
| `created_by` | uuid not null → auth.users | who logged it; set by existing `set_created_by()` trigger |
| `title` | text not null | `check (btrim(title) <> '')` |
| `note` | text null | optional details/location |
| `all_day` | boolean not null default false | |
| `start_at` | timestamptz not null | timed start; for all-day, the day boundary |
| `end_at` | timestamptz not null | timed end; multi-day = later day; all-day single day = same day's end. Non-null keeps expansion/rendering simple; `check (end_at >= start_at)` |
| `recurrence_freq` | enum `calendar_recurrence_freq` (`none\|daily\|weekly\|monthly\|yearly`) not null default `none` | |
| `recurrence_until` | date null | inclusive last date a recurrence may land on; null = no end |
| `created_at`, `updated_at` | timestamptz | `set_updated_at()` trigger |

- `owner_id` validation: an insert/update with a non-null `owner_id` must be a
  member of the same household. Enforce with a trigger (or a check via
  `is_household_member`-style lookup) so one household can't attribute an event
  to another household's user. Simplest: a `before insert/update` trigger that
  raises if `owner_id is not null and not is_household_member_user(owner_id, household_id)`.
  (If a suitable helper doesn't exist, add a small one alongside the migration.)
- RLS: `household rw` policy — `using/with check (is_household_member(household_id))`.
- Realtime: add to `supabase_realtime` publication + `replica identity full`.
- Index: `calendar_events (household_id, start_at)`.

After the migration: `supabase db push`, then regenerate
`src/types/database.ts` via the `supabase gen types` command in `CLAUDE.md`.

## Recurrence expansion

`expandOccurrences(events, rangeStart, rangeEnd)` — a **pure function** in
`src/lib/calendar.ts` (unit-tested). Uses `date-fns` (already a dependency).

- Non-recurring event → one occurrence if it overlaps `[rangeStart, rangeEnd]`.
- Recurring event → step from `start_at` by the frequency (`addDays`/`addWeeks`/
  `addMonths`/`addYears`), emitting each occurrence that falls within the range
  and on/before `recurrence_until`. Preserve the event's duration
  (`end_at - start_at`) for each occurrence. Cap the loop defensively (e.g., a
  max iteration count) so a bad rule can't spin.
- Each emitted occurrence carries the source event id + its concrete
  `start`/`end`, so the UI can render it and open the series for editing.

Dataset is tiny (two-person household), so `useCalendar` fetches **all**
household events and expands client-side for the visible month — no
range-query complexity.

## Components

New files:
- `src/routes/CalendarPage.tsx` — owns selected-month + selected-day state;
  wires realtime via `useRealtimeTable` (per `supabase-realtime-query-sync`).
- `src/hooks/useCalendar.ts` — query + CRUD mutations, mirroring
  `src/hooks/useSavings.ts`; writes go through the offline outbox per the
  `offline-mutation-outbox` skill (same as Budget/Savings).
- `src/components/calendar/MonthGrid.tsx` — Swiss month grid; each day cell
  shows up to N colored dots (by owner color) with a "+k" overflow; current day
  and selected day highlighted; prev/next month nav.
- `src/components/calendar/DayEventList.tsx` — selected day's occurrences
  (time · title · owner chip), tap to edit.
- `src/components/calendar/EventDialog.tsx` — add/edit form: title, whose
  (You / Partner / Shared), all-day toggle, start/end date+time, recurrence
  (freq + until), note. Delete action (confirms it removes the whole series for
  recurring events). Uses the hardened `Dialog` primitive.
- `src/lib/calendar.ts` — `expandOccurrences` + small helpers (owner→color).

Wiring:
- `src/components/layout/nav-items.ts` / `BottomNav.tsx` / `Sidebar.tsx` /
  `HomePage.tsx` — add Calendar as an extra top-level destination, the same way
  Savings is appended (Savings currently lives in `EXTRA_TABS`/`EXTRA_LINKS`/
  `EXTRA_TILES`). New route `/calendar` in `src/App.tsx`. Calendar icon from
  `lucide-react`.

## Attribution & color

Exactly two members (`household.members`). Map the two members to two fixed
colors by stable `user_id` sort order; Shared gets a third. A small legend
(You ● / <Partner name> ● / Shared ●) shows the mapping. This is a deliberate,
minimal extension to the Swiss monochrome + mustard palette — three distinct,
accessible hues (dark text/!contrast checked). `owner_id === null` → Shared
color; `owner_id === me` → my color; else partner color.

## Data flow

1. `CalendarPage` reads the visible month + selected day (default: today).
2. `useCalendar` returns all household events (cached, realtime-synced).
3. `expandOccurrences(events, monthGridStart, monthGridEnd)` → occurrences for
   the six-week grid window.
4. `MonthGrid` renders dots per day; selecting a day filters occurrences to
   `DayEventList`.
5. Add/edit → `EventDialog` → `useCalendar` mutation → optimistic update +
   outbox + realtime.

## Error handling

- Offline writes queue in the Dexie outbox and flush on reconnect (existing
  `offline-mutation-outbox` machinery — no new code path).
- Realtime keeps both devices in sync (`useRealtimeTable`).
- Editing/deleting a recurring event affects the **whole series** in v1; the
  delete confirm states this explicitly.
- Invalid range (`end_at < start_at`) blocked in the form and by the DB check.
- Loading / error / empty states match the Savings page conventions.

## Testing

- `src/test/calendar.test.ts` — `expandOccurrences` pure-function unit tests
  (each freq, until boundary, multi-day duration preservation, non-recurring
  overlap, defensive cap).
- `src/test/useCalendar.test.tsx` — hook CRUD, mirroring
  `src/test/useSavings.test.tsx`.
- `src/test/CalendarPage.test.tsx` (or `MonthGrid`/`EventDialog` component
  tests) — month renders dots, tapping a day lists its events, add/edit/delete
  flow, owner color mapping.
- Nav/route test additions where Savings is currently asserted.
- Manual: add each event type/owner on one device; confirm colors, month dots,
  day list, and realtime appearance on the other device; verify offline add
  then reconnect sync.

## Out of scope for this spec (future)

Reminders/push, multi-weekday weekly, per-occurrence exceptions, week/agenda
views, and the React Native port (handled by the RN migration phases).
