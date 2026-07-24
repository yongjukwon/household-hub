import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queueWrite } from '@/lib/offline/outbox'
import type { CalendarEvent, RecurrenceFreq } from '@/lib/calendar'

export const calendarKeys = {
  all: ['calendar'] as const,
  events: () => ['calendar', 'events'] as const,
}

export function useCalendarEvents() {
  return useQuery({
    queryKey: calendarKeys.events(),
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_at', { ascending: true })
        .order('id', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export interface SaveCalendarEventInput {
  id: string
  householdId: string
  ownerId: string | null
  title: string
  note: string | null
  allDay: boolean
  startAt: string
  endAt: string
  recurrenceFreq: RecurrenceFreq
  recurrenceUntil: string | null
}

/** Create or edit an event (upsert on id), queued through the offline outbox. */
export function useSaveCalendarEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: SaveCalendarEventInput,
    ): Promise<'synced' | 'queued'> => {
      const now = new Date().toISOString()
      queryClient.setQueryData<CalendarEvent[]>(
        calendarKeys.events(),
        (old = []) => {
          // created_by/household_id are server-derived truth; the optimistic
          // row only needs enough to render until the query refetches.
          const optimistic: CalendarEvent = {
            id: input.id,
            household_id: input.householdId,
            owner_id: input.ownerId,
            created_by: old.find((e) => e.id === input.id)?.created_by ?? '',
            title: input.title,
            note: input.note,
            all_day: input.allDay,
            start_at: input.startAt,
            end_at: input.endAt,
            recurrence_freq: input.recurrenceFreq,
            recurrence_until: input.recurrenceUntil,
            created_at: old.find((e) => e.id === input.id)?.created_at ?? now,
            updated_at: now,
          }
          const without = old.filter((e) => e.id !== input.id)
          return [...without, optimistic].sort((a, b) =>
            a.start_at.localeCompare(b.start_at),
          )
        },
      )

      return queueWrite({
        clientId: input.id,
        table: 'calendar_events',
        op: 'upsert',
        payload: {
          id: input.id,
          household_id: input.householdId,
          owner_id: input.ownerId,
          title: input.title,
          note: input.note,
          all_day: input.allDay,
          start_at: input.startAt,
          end_at: input.endAt,
          recurrence_freq: input.recurrenceFreq,
          recurrence_until: input.recurrenceUntil,
        },
        match: { id: input.id },
      })
    },
    onSuccess: (status) => {
      if (status === 'synced') {
        queryClient.invalidateQueries({ queryKey: calendarKeys.events() })
      }
    },
  })
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<'synced' | 'queued'> => {
      queryClient.setQueryData<CalendarEvent[]>(
        calendarKeys.events(),
        (old = []) => old.filter((e) => e.id !== id),
      )
      return queueWrite({
        clientId: id,
        table: 'calendar_events',
        op: 'delete',
        payload: {},
        match: { id },
      })
    },
    onSuccess: (status) => {
      if (status === 'synced') {
        queryClient.invalidateQueries({ queryKey: calendarKeys.events() })
      }
    },
  })
}
