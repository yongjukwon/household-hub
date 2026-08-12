import {
  buildCalendarEventPayload,
  type CalendarEventForm,
} from '@household-hub/application/feature-data'
import { enqueueOperation, type EnqueueOutcome } from '@/lib/operations'

/** Form model for creating/editing a calendar event. */
export type { CalendarEventForm }

/**
 * Builds the `calendar.event.upsert` payload the RPC expects. All-day and timed
 * events carry disjoint time fields. The RPC validator requires the inactive
 * pair to be absent rather than present with null values.
 */
export function buildEventPayload(form: CalendarEventForm): Record<string, unknown> {
  return buildCalendarEventPayload(form)
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
    optimistic: {
      title: payload.title,
      note: payload.note,
      ownerId: form.ownerId,
      allDay: form.allDay,
      startsAt: form.allDay ? null : form.startAt,
      endsAt: form.allDay ? null : form.endAt,
      startDate: form.allDay ? form.startDate : null,
      endDate: form.allDay ? form.endDate : null,
      timeZone: form.timezone,
      recurrenceFrequency: form.recurrenceFrequency,
      recurrenceUntil:
        form.recurrenceFrequency === 'none' ? null : form.recurrenceUntil,
      reminders: form.reminders,
      revision: baseRevision ?? 1,
    },
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
