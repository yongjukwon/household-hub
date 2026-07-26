/**
 * Pure helpers for the Calendar month grid. Dates are handled as `YYYY-MM-DD`
 * strings in the viewer's local civil date space — never as `Date` instants —
 * so the grid never drifts across a timezone boundary. Event placement uses the
 * device-timezone civil date computed by the domain's `calendarDateInTimeZone`.
 */

/** A single day cell in the month grid. */
export interface MonthGridCell {
  /** Civil date, `YYYY-MM-DD`. */
  date: string
  /** Day-of-month number, 1-31. */
  day: number
  /** False for the leading/trailing days that belong to an adjacent month. */
  inMonth: boolean
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** `YYYY-MM-DD` for a UTC-normalized civil date (no timezone drift). */
export function toDateKey(year: number, month1: number, day: number): string {
  return `${year}-${pad(month1)}-${pad(day)}`
}

/** Today's civil date in the given timezone, as `YYYY-MM-DD`. */
export function todayKey(
  timeZone: string,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '01'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Builds a 6-row × 7-column (Sunday-first) grid covering the given month, with
 * leading/trailing days from the adjacent months so every week is complete.
 * `year` is full (e.g. 2026); `month1` is 1-based (1 = January).
 */
export function buildMonthGrid(year: number, month1: number): MonthGridCell[] {
  const firstOfMonth = new Date(Date.UTC(year, month1 - 1, 1))
  const leading = firstOfMonth.getUTCDay() // 0 = Sunday
  const gridStart = new Date(Date.UTC(year, month1 - 1, 1 - leading))

  const cells: MonthGridCell[] = []
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart)
    d.setUTCDate(gridStart.getUTCDate() + i)
    const cellYear = d.getUTCFullYear()
    const cellMonth = d.getUTCMonth() + 1
    const cellDay = d.getUTCDate()
    cells.push({
      date: toDateKey(cellYear, cellMonth, cellDay),
      day: cellDay,
      inMonth: cellMonth === month1 && cellYear === year,
    })
  }
  return cells
}

/** Inclusive list of civil dates an all-day/multiday span covers. */
export function datesInSpan(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const start = Date.UTC(sy, sm - 1, sd)
  const end = Date.UTC(ey, em - 1, ed)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return startDate ? [startDate] : []
  }
  const out: string[] = []
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t)
    out.push(toDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()))
  }
  return out
}

/** Human month label, e.g. "July 2026". */
export function monthLabel(year: number, month1: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month1 - 1, 1)))
}

/** Steps a {year, month1} pair by whole months, normalizing rollover. */
export function shiftMonth(
  year: number,
  month1: number,
  delta: number,
): { year: number; month1: number } {
  const zeroBased = month1 - 1 + delta
  const nextYear = year + Math.floor(zeroBased / 12)
  const nextMonth = ((zeroBased % 12) + 12) % 12
  return { year: nextYear, month1: nextMonth + 1 }
}
