import {
  calendarDateInTimeZone,
  formatMoney,
  type CalendarTime,
} from '@household-hub/domain'

/**
 * Mobile-facing presentation helpers. They are thin adapters over the shared
 * domain so the native UI formats money and dates identically to the web client
 * — one contract, no per-platform drift. Money is never converted between
 * currencies; foreign amounts render in their own currency.
 */

export function formatCents(cents: number, currency: string): string {
  return formatMoney(cents, currency)
}

/** The calendar day an event falls on when viewed in the device's time zone. */
export function eventDayInTimeZone(
  time: CalendarTime,
  timeZone: string,
): string {
  return calendarDateInTimeZone(time, timeZone)
}

/** Wall-clock time (e.g. `2:30 PM`) of a UTC instant in a given zone. */
export function formatTimeInZone(
  isoInstant: string,
  timeZone: string,
  locale = 'en-CA',
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoInstant))
}
