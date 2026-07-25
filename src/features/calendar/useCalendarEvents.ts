import { useQuery } from '@tanstack/react-query'
import {
  queryKeys,
  type ReminderPreset,
} from '@household-hub/domain'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { CalendarEventItem, RecurrenceFrequency } from './events'
import { reminderFromDatabase } from './reminders'

type EventRow = Tables<'calendar_events'>
type ReminderRow = Pick<Tables<'calendar_event_reminders'>, 'event_id' | 'preset'>

function toItem(row: EventRow, reminders: ReminderPreset[]): CalendarEventItem {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    ownerId: row.owner_id,
    allDay: row.all_day,
    timeZone: row.event_timezone,
    startsAt: row.start_at,
    endsAt: row.end_at,
    startDate: row.start_date,
    endDate: row.end_date,
    recurrenceFrequency: row.recurrence_freq as RecurrenceFrequency,
    recurrenceUntil: row.recurrence_until,
    reminders,
    revision: row.revision,
  }
}

/**
 * All calendar events for the household with their reminder presets. The client
 * expands recurrence and multiday spans per visible month (see `events.ts`), so
 * a single household-scoped read backs every month view; Realtime keeps it
 * fresh and the durable queue applies optimistic overlays on top.
 */
export function useCalendarEvents(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId
      ? queryKeys.calendar.month(householdId, 0, 0)
      : ['calendar', 'disabled'],
    enabled: !!householdId,
    queryFn: async (): Promise<CalendarEventItem[]> => {
      const [events, reminders] = await Promise.all([
        supabase
          .from('calendar_events')
          .select('*')
          .order('start_at', { ascending: true, nullsFirst: false })
          .order('start_date', { ascending: true, nullsFirst: false })
          .returns<EventRow[]>(),
        supabase
          .from('calendar_event_reminders')
          .select('event_id, preset')
          .returns<ReminderRow[]>(),
      ])
      if (events.error) throw events.error
      if (reminders.error) throw reminders.error

      const byEvent = new Map<string, ReminderPreset[]>()
      for (const r of reminders.data ?? []) {
        const preset = reminderFromDatabase(r.preset)
        if (!preset) continue
        const list = byEvent.get(r.event_id) ?? []
        list.push(preset)
        byEvent.set(r.event_id, list)
      }

      return (events.data ?? []).map((row) =>
        toItem(row, byEvent.get(row.id) ?? []),
      )
    },
  })
}
