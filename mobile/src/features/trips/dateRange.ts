export interface TripDateRange {
  startDate: string
  endDate: string | null
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dateParts(dateKey: string): [number, number, number] {
  const [year, month, day] = dateKey.split('-').map(Number)
  return [year, month, day]
}

/** A local civil date key without converting the Date through UTC. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Advances a civil date by one calendar day, including month/year rollover. */
export function nextCivilDate(dateKey: string): string {
  const [year, month, day] = dateParts(dateKey)
  return localDateKey(new Date(year, month - 1, day + 1, 12))
}

export function defaultTripDateRange(
  now: Date = new Date(),
): { startDate: string; endDate: string } {
  const startDate = localDateKey(now)
  return {
    startDate,
    endDate: nextCivilDate(startDate),
  }
}

/**
 * A completed range's next tap starts over. An incomplete range's second tap
 * completes it, unless that date precedes Start, in which case it becomes the
 * new Start.
 */
export function selectTripRangeDate(
  current: TripDateRange,
  selectedDate: string,
): TripDateRange {
  if (current.endDate !== null) {
    return { startDate: selectedDate, endDate: null }
  }
  if (selectedDate < current.startDate) {
    return { startDate: selectedDate, endDate: null }
  }
  return { startDate: current.startDate, endDate: selectedDate }
}

function displayDate(dateKey: string): string {
  const [year, month, day] = dateParts(dateKey)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatTripDateRange(
  startDate: string,
  endDate: string,
): string {
  return `${displayDate(startDate)} – ${displayDate(endDate)}`
}

export function monthFromDateKey(dateKey: string): {
  year: number
  month1: number
} {
  const [year, month1] = dateParts(dateKey)
  return { year, month1 }
}
