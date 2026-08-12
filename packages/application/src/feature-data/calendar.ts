import type { ReminderPreset } from '@household-hub/domain'

export type RecurrenceFrequency =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'

export interface CalendarEventForm {
  id: string
  ownerId: string | null
  title: string
  note: string | null
  allDay: boolean
  startAt: string | null
  endAt: string | null
  startDate: string | null
  endDate: string | null
  timezone: string
  recurrenceFrequency: RecurrenceFrequency
  recurrenceUntil: string | null
  reminders: ReminderPreset[]
}

export type DatabaseReminderPreset = 'at_time' | '10m' | '1h' | '1d' | '1w'

export function reminderToDatabase(
  preset: ReminderPreset,
): DatabaseReminderPreset | null {
  if (preset === 'none') return null
  return preset === 'at-time' ? 'at_time' : preset
}

export function buildCalendarEventPayload(
  form: CalendarEventForm,
): Record<string, unknown> {
  return {
    ownerId: form.ownerId,
    title: form.title.trim(),
    note: form.note && form.note.trim().length > 0 ? form.note.trim() : null,
    allDay: form.allDay,
    ...(form.allDay
      ? { startDate: form.startDate, endDate: form.endDate }
      : { startAt: form.startAt, endAt: form.endAt }),
    timezone: form.timezone,
    recurrenceFrequency: form.recurrenceFrequency,
    recurrenceUntil:
      form.recurrenceFrequency === 'none' ? null : form.recurrenceUntil,
    reminders: form.reminders.flatMap((preset) => {
      const stored = reminderToDatabase(preset)
      return stored ? [stored] : []
    }),
  }
}
