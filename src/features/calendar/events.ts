import {
  calendarDateInTimeZone,
  type CalendarTime,
  type ReminderPreset,
  type TimeZone,
} from '@household-hub/domain'
import { datesInSpan } from './monthGrid'

export type RecurrenceFrequency =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'

/** Normalized, client-facing calendar event (independent of the DB row shape). */
export interface CalendarEventItem {
  id: string
  title: string
  note: string | null
  ownerId: string | null
  allDay: boolean
  timeZone: string
  /** Timed events only (ISO-8601 UTC instants). */
  startsAt: string | null
  endsAt: string | null
  /** All-day events only (`YYYY-MM-DD`). */
  startDate: string | null
  endDate: string | null
  recurrenceFrequency: RecurrenceFrequency
  recurrenceUntil: string | null
  reminders: ReminderPreset[]
  revision: number
}

/** The event's `CalendarTime`, for device-timezone date resolution. */
export function calendarTimeOf(event: CalendarEventItem): CalendarTime {
  if (event.allDay) {
    return {
      kind: 'all-day',
      startDate: event.startDate ?? '',
      endDate: event.endDate ?? event.startDate ?? '',
    }
  }
  return {
    kind: 'timed',
    startsAt: event.startsAt ?? '',
    endsAt: event.endsAt ?? event.startsAt ?? '',
    timeZone: event.timeZone as TimeZone,
  }
}

/** Civil start/end dates of the event's first (anchor) occurrence, in `viewTz`. */
function anchorSpan(
  event: CalendarEventItem,
  viewTz: string,
): { start: string; end: string } {
  if (event.allDay) {
    const start = event.startDate ?? ''
    return { start, end: event.endDate ?? start }
  }
  const tz = event.timeZone as TimeZone
  const start = calendarDateInTimeZone(
    { kind: 'timed', startsAt: event.startsAt ?? '', endsAt: event.endsAt ?? '', timeZone: tz },
    viewTz,
  )
  const end = calendarDateInTimeZone(
    {
      kind: 'timed',
      startsAt: event.endsAt ?? event.startsAt ?? '',
      endsAt: event.endsAt ?? event.startsAt ?? '',
      timeZone: tz,
    },
    viewTz,
  )
  return { start, end }
}

function toUtcDate(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtcDate(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

const DAY = 86_400_000

/** Steps an anchor date forward by one recurrence period, preserving fields. */
function stepOccurrence(anchor: string, freq: RecurrenceFrequency, n: number): string {
  const [y, m, d] = anchor.split('-').map(Number)
  switch (freq) {
    case 'daily':
      return fromUtcDate(toUtcDate(anchor) + n * DAY)
    case 'weekly':
      return fromUtcDate(toUtcDate(anchor) + n * 7 * DAY)
    case 'monthly': {
      const target = new Date(Date.UTC(y, m - 1 + n, d))
      // Skip months that don't have this day-of-month (e.g. day 31).
      if (target.getUTCDate() !== d) return ''
      return fromUtcDate(target.getTime())
    }
    case 'yearly': {
      const target = new Date(Date.UTC(y + n, m - 1, d))
      if (target.getUTCDate() !== d) return '' // Feb 29 in a common year
      return fromUtcDate(target.getTime())
    }
    default:
      return n === 0 ? anchor : ''
  }
}

/**
 * Every civil date (in `viewTz`) on which this event appears within
 * `[rangeStart, rangeEnd]` (inclusive), expanding recurrence and multiday
 * spans. Bounded by `recurrenceUntil` when set.
 */
export function eventDatesInRange(
  event: CalendarEventItem,
  rangeStart: string,
  rangeEnd: string,
  viewTz: string,
): string[] {
  const { start, end } = anchorSpan(event, viewTz)
  if (!start) return []
  const spanDays = Math.max(0, Math.round((toUtcDate(end) - toUtcDate(start)) / DAY))
  const rangeStartMs = toUtcDate(rangeStart)
  const rangeEndMs = toUtcDate(rangeEnd)
  const untilMs = event.recurrenceUntil ? toUtcDate(event.recurrenceUntil) : Infinity

  const hits = new Set<string>()
  const freq = event.recurrenceFrequency

  // Cap iterations so a runaway recurrence can never loop unbounded.
  for (let n = 0; n < 1000; n += 1) {
    const occurrenceStart = stepOccurrence(start, freq, n)
    if (!occurrenceStart) {
      if (freq === 'none') break
      continue
    }
    const occStartMs = toUtcDate(occurrenceStart)
    if (occStartMs > untilMs) break
    if (occStartMs - spanDays * DAY > rangeEndMs) break
    const occEndMs = occStartMs + spanDays * DAY
    if (occEndMs >= rangeStartMs && occStartMs <= rangeEndMs) {
      for (const day of datesInSpan(occurrenceStart, fromUtcDate(occEndMs))) {
        if (toUtcDate(day) >= rangeStartMs && toUtcDate(day) <= rangeEndMs) {
          hits.add(day)
        }
      }
    }
    if (freq === 'none') break
  }
  return [...hits].sort()
}

/** Whether the event appears on a single civil date, in `viewTz`. */
export function eventOccursOn(
  event: CalendarEventItem,
  dateKey: string,
  viewTz: string,
): boolean {
  return eventDatesInRange(event, dateKey, dateKey, viewTz).length > 0
}

/** Sort key for a day's event list: all-day first, then by start instant. */
export function eventSortKey(event: CalendarEventItem): string {
  return event.allDay ? `0` : `1-${event.startsAt ?? ''}`
}
