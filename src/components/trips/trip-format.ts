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
