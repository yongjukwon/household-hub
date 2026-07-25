import type { ReminderPreset } from '@household-hub/domain'
import { enqueueOperation, type EnqueueOutcome } from '@/lib/operations'
import type { RecurrenceFrequency } from './events'

/** Form model for creating/editing a calendar event. */
export interface CalendarEventForm {
  id: string
  ownerId: string | null
  title: string
  note: string | null
  allDay: boolean
  /** Timed events: ISO-8601 UTC instants. */
  startAt: string | null
  endAt: string | null
  /** All-day events: `YYYY-MM-DD`. */
  startDate: string | null
  endDate: string | null
  timezone: string
  recurrenceFrequency: RecurrenceFrequency
  recurrenceUntil: string | null
  reminders: ReminderPreset[]
}

/**
 * Builds the `calendar.event.upsert` payload the RPC expects. All-day and timed
 * events carry disjoint time fields; the server nulls the other set, but we send
 * a clean payload so the optimistic overlay matches server truth.
 */
export function buildEventPayload(form: CalendarEventForm): Record<string, unknown> {
  return {
    ownerId: form.ownerId,
    title: form.title.trim(),
    note: form.note && form.note.trim().length > 0 ? form.note.trim() : null,
    allDay: form.allDay,
    startAt: form.allDay ? null : form.startAt,
    endAt: form.allDay ? null : form.endAt,
    startDate: form.allDay ? form.startDate : null,
    endDate: form.allDay ? form.endDate : null,
    timezone: form.timezone,
    recurrenceFrequency: form.recurrenceFrequency,
    recurrenceUntil:
      form.recurrenceFrequency === 'none' ? null : form.recurrenceUntil,
    reminders: form.reminders,
  }
}

/** Enqueues a create/edit of a calendar event through the durable queue. */
export function saveCalendarEvent(
  householdId: string,
  form: CalendarEventForm,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = buildEventPayload(form)
  return enqueueOperation({
    householdId,
    type: 'calendar.event.upsert',
    entityType: 'calendar_event',
    entityId: form.id,
    baseRevision,
    payload,
    optimistic: payload,
  })
}

/** Enqueues deletion of a calendar event. */
export function deleteCalendarEvent(
  householdId: string,
  eventId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'calendar.event.delete',
    entityType: 'calendar_event',
    entityId: eventId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}
