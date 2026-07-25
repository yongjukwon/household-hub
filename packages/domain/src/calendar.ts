import { type TimeZone, isIsoDateTime, isRecord, isTimeZone } from './validation'

export type TimedCalendarTime = {
  kind: 'timed'
  startsAt: string
  endsAt: string
  timeZone: TimeZone
}

export type AllDayCalendarTime = {
  kind: 'all-day'
  startDate: string
  endDate: string
}

export type CalendarTime = TimedCalendarTime | AllDayCalendarTime

/** Timed events move with the viewer; all-day events retain their date. */
export function calendarDateInTimeZone(
  time: CalendarTime,
  viewingTimeZone: TimeZone | string,
): string {
  if (time.kind === 'all-day') return time.startDate

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: viewingTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time.startsAt))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value

  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isCalendarTime(value: unknown): value is CalendarTime {
  if (!isRecord(value)) return false

  if (value.kind === 'timed') {
    return (
      isUtcInstant(value.startsAt) &&
      isUtcInstant(value.endsAt) &&
      Date.parse(value.endsAt) > Date.parse(value.startsAt) &&
      isTimeZone(value.timeZone)
    )
  }

  return (
    value.kind === 'all-day' &&
    isDateOnly(value.startDate) &&
    isDateOnly(value.endDate) &&
    value.endDate >= value.startDate
  )
}

function isUtcInstant(value: unknown): value is string {
  return typeof value === 'string' && value.endsWith('Z') && isIsoDateTime(value)
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}
