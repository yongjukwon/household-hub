import type { BookingType } from '@/hooks/useTrip'

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
