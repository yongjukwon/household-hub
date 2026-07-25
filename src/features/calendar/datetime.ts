/**
 * Wall-clock ↔ UTC conversion for a named IANA timezone, without a date
 * library. Timed events are entered as a wall-clock time *in the event
 * timezone* and stored as a UTC instant; these helpers bridge the two.
 */

/** Milliseconds `tz`'s local wall clock is ahead of UTC at `date`. */
function tzOffsetMs(tz: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - date.getTime()
}

/**
 * Converts a `YYYY-MM-DDTHH:mm` wall-clock string (interpreted in `tz`) to a
 * UTC ISO-8601 instant. Uses one offset correction, which is exact except in
 * the rare DST-gap minute.
 */
export function zonedWallToUtc(wall: string, tz: string): string {
  const [datePart, timePart] = wall.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const offset = tzOffsetMs(tz, new Date(guess))
  return new Date(guess - offset).toISOString()
}

/** Converts a UTC ISO instant to a `YYYY-MM-DDTHH:mm` wall string in `tz`. */
export function utcToZonedWall(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Short time label for a timed event in the viewer's timezone, e.g. "2:30 PM". */
export function formatEventTime(iso: string, viewTz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: viewTz,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}
