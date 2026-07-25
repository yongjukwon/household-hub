// Timezone-aware date arithmetic for the scheduled jobs.
//
// Reminder fire times and recurring-transfer occurrences are both defined in a
// stored IANA timezone ("09:00 in the event's timezone", "the 5th at 08:00 in
// the schedule's timezone"), so they cannot be computed with UTC arithmetic —
// DST changes the instant a wall-clock time refers to. Temporal is not
// available on the edge runtime, so offsets come from Intl.

/** Minutes east of UTC that `timeZone` was at `instant`. */
export function timeZoneOffsetMinutes(timeZone: string, instant: Date): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).format(instant)

  const match = /GMT(?:([+-])(\d{2}):(\d{2}))?/.exec(formatted)
  if (!match) {
    throw new Error(`Cannot resolve a UTC offset for time zone "${timeZone}"`)
  }
  // Zones sitting exactly on UTC format as a bare "GMT".
  if (!match[1]) return 0

  const magnitude = Number(match[2]) * 60 + Number(match[3])
  return match[1] === '-' ? -magnitude : magnitude
}

/**
 * The instant at which `timeZone` reads `date` at `minutesOfDay`.
 *
 * The offset depends on the instant being solved for, so the naive guess is
 * corrected once. Ambiguity is resolved the way scheduling needs it:
 *
 *   * fall-back (the wall time happens twice) → the earlier instant, i.e. the
 *     first time the clock reads it;
 *   * spring-forward (the wall time never happens) → the instant the clock
 *     jumped to, so a schedule anchored inside the gap still runs that day, at
 *     the first moment its wall time becomes valid.
 */
export function zonedDateTimeToInstant(
  date: string,
  minutesOfDay: number,
  timeZone: string,
): Date {
  const [year, month, day] = date.split('-').map(Number)
  const naive = Date.UTC(year, month - 1, day, 0, minutesOfDay)

  const guessedOffset = timeZoneOffsetMinutes(timeZone, new Date(naive))
  const firstCandidate = naive - guessedOffset * 60_000
  const actualOffset = timeZoneOffsetMinutes(timeZone, new Date(firstCandidate))
  if (actualOffset === guessedOffset) return new Date(firstCandidate)

  const secondCandidate = naive - actualOffset * 60_000
  const confirmedOffset = timeZoneOffsetMinutes(
    timeZone,
    new Date(secondCandidate),
  )
  if (confirmedOffset === actualOffset) return new Date(secondCandidate)

  // Neither offset is self-consistent: the requested wall time falls in a
  // spring-forward gap, which the transition instant itself sits inside.
  return transitionInstant(
    secondCandidate,
    firstCandidate,
    timeZone,
    actualOffset,
  )
}

const MINUTE_MS = 60_000

/**
 * The first instant in `(before, after]` whose offset is `offsetAfter`, i.e. the
 * moment the zone changed offset. Transitions land on whole minutes, so the
 * search stops there.
 */
function transitionInstant(
  before: number,
  after: number,
  timeZone: string,
  offsetAfter: number,
): Date {
  let low = before
  let high = after

  while (high - low > MINUTE_MS) {
    const mid = low + Math.floor((high - low) / 2 / MINUTE_MS) * MINUTE_MS
    if (mid === low) break
    if (timeZoneOffsetMinutes(timeZone, new Date(mid)) === offsetAfter) {
      high = mid
    } else {
      low = mid
    }
  }

  return new Date(high)
}

export type ZonedParts = {
  /** `YYYY-MM-DD` in the target zone. */
  date: string
  /** Minutes since local midnight. */
  minutesOfDay: number
}

/** How `timeZone` reads `instant`. */
export function instantToZonedParts(
  instant: Date,
  timeZone: string,
): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00'

  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutesOfDay: Number(value('hour')) * 60 + Number(value('minute')),
  }
}

/** Number of days in a calendar month. `month` is 1-based. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function formatDate(year: number, month: number, day: number): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
}

/** Calendar-day arithmetic on a `YYYY-MM-DD` string; no timezone involved. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return formatDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  )
}

/**
 * `date` shifted by whole months, keeping the day of month but clamping to the
 * target month's length — so a schedule anchored on the 31st runs on the 28th
 * or 30th rather than spilling into the next month.
 */
export function addMonthsClamped(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const zeroBased = month - 1 + months
  const targetYear = year + Math.floor(zeroBased / 12)
  const targetMonth = (((zeroBased % 12) + 12) % 12) + 1

  return formatDate(
    targetYear,
    targetMonth,
    Math.min(day, daysInMonth(targetYear, targetMonth)),
  )
}

/** `date` with its day of month replaced, clamped to the month's length. */
export function withDayOfMonthClamped(
  date: string,
  dayOfMonth: number,
): string {
  const [year, month] = date.split('-').map(Number)
  return formatDate(year, month, Math.min(dayOfMonth, daysInMonth(year, month)))
}
