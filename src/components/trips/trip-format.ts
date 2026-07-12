import type { BookingType } from '@/hooks/useTrip'

/**
 * Each calendar day from `start` to `end` inclusive, as `yyyy-MM-dd` strings.
 * Returns [] if either bound is missing or the range is inverted. Parses the
 * date parts directly (no UTC/local shift) so the days match the inputs.
 */
export function daysInRange(
  start: string | null,
  end: string | null,
): string[] {
  if (!start || !end) return []
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  if ([sy, sm, sd, ey, em, ed].some((n) => Number.isNaN(n))) return []
  const days: string[] = []
  const cursor = new Date(sy, sm - 1, sd)
  const last = new Date(ey, em - 1, ed)
  if (cursor > last) return []
  const pad = (n: number) => String(n).padStart(2, '0')
  while (cursor <= last) {
    days.push(
      `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`,
    )
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/** "Sat, Aug 2" for a `yyyy-MM-dd` day (used by the itinerary date dropdown). */
export function formatDayOption(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(y, m - 1, d))
}

/** "Aug 1 – Aug 7" trip-period summary, or null when not fully set. */
export function formatDateRange(
  start: string | null,
  end: string | null,
): string | null {
  if (!start || !end) return null
  const fmt = (day: string) => {
    const [y, m, d] = day.split('-').map(Number)
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(y, m - 1, d))
  }
  return `${fmt(start)} – ${fmt(end)}`
}

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  car: 'Car',
  other: 'Other',
}

/**
 * Booking timestamps are entered as device-local wall-clock times and stored
 * as UTC (timestamptz). They render back correctly in the household's own
 * timezone; times for destinations in another timezone are shown device-local.
 */
export function localInputToIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function isoToLocalInput(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Normalizes a user-typed link for storage: trims, treats blank as null, and
 * prefixes `https://` when no scheme is present so a bare `example.com` still
 * becomes a working href. Returns `undefined` for input that can't be a URL.
 */
export function normalizeUrl(value: string): string | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  // A bare host like "example.com" gets https://; anything that already
  // carries a scheme (including unsafe ones like javascript:/mailto:) is
  // parsed as-is so the http/https protocol check below can reject it.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  const candidate = hasScheme ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.toString()
  } catch {
    return undefined
  }
}
