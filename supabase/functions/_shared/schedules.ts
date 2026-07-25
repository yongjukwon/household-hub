// Pure occurrence enumeration for the recurring-transfer-executor function.
//
// A schedule stores an anchor instant plus the timezone it was created in, so
// occurrences keep their wall-clock time across daylight saving. The database
// owns idempotency (unique on schedule + occurrence date); this module only
// decides which dates are owed.

import {
  addDays,
  addMonthsClamped,
  instantToZonedParts,
  withDayOfMonthClamped,
  zonedDateTimeToInstant,
} from './timezone.ts'

export type TransferFrequency =
  'weekly' | 'biweekly' | 'semi_monthly' | 'monthly'

export type TransferSchedule = {
  scheduleId: string
  householdId: string
  fromAssetId: string
  toAssetId: string
  amountCents: number
  frequency: string
  /** UTC instant of the first occurrence. */
  startsAt: string
  timezone: string
  /** `YYYY-MM-DD` of the latest occurrence already executed, if any. */
  lastOccurrenceDate: string | null
}

export type TransferOccurrence = {
  /** `YYYY-MM-DD` in the schedule's timezone; the idempotency key. */
  occurrenceDate: string
  /** The instant that local date and time resolve to. */
  occurredAt: Date
}

/**
 * A single run never materializes more than this many occurrences for one
 * schedule. A long outage catches up over several runs instead of emitting an
 * unbounded burst of transfers in one transaction.
 */
export const MAX_OCCURRENCES_PER_RUN = 24

export function isTransferFrequency(value: string): value is TransferFrequency {
  return (
    value === 'weekly' ||
    value === 'biweekly' ||
    value === 'semi_monthly' ||
    value === 'monthly'
  )
}

/**
 * Occurrences owed by `schedule` as of `now`: strictly after the last executed
 * date, no later than now, capped at `MAX_OCCURRENCES_PER_RUN`.
 */
export function dueOccurrences(
  schedule: TransferSchedule,
  now: Date,
  maxOccurrences = MAX_OCCURRENCES_PER_RUN,
): TransferOccurrence[] {
  if (!isTransferFrequency(schedule.frequency)) {
    throw new Error(
      `Schedule ${schedule.scheduleId} has unsupported frequency "${schedule.frequency}"`,
    )
  }

  const anchor = instantToZonedParts(
    new Date(schedule.startsAt),
    schedule.timezone,
  )
  const due: TransferOccurrence[] = []

  for (const date of occurrenceDates(anchor.date, schedule.frequency)) {
    if (schedule.lastOccurrenceDate && date <= schedule.lastOccurrenceDate) {
      continue
    }

    const occurredAt = zonedDateTimeToInstant(
      date,
      anchor.minutesOfDay,
      schedule.timezone,
    )
    if (occurredAt.getTime() > now.getTime()) break

    due.push({ occurrenceDate: date, occurredAt })
    if (due.length >= maxOccurrences) break
  }

  return due
}

/**
 * Every occurrence date from the anchor onwards, in order.
 *
 * Semi-monthly pairs the anchor day with a day fifteen days away, so an anchor
 * on the 20th runs on the 5th and the 20th; both are clamped to short months.
 */
function* occurrenceDates(
  anchorDate: string,
  frequency: TransferFrequency,
): Generator<string> {
  if (frequency === 'weekly' || frequency === 'biweekly') {
    const step = frequency === 'weekly' ? 7 : 14
    let date = anchorDate
    while (true) {
      yield date
      date = addDays(date, step)
    }
  }

  if (frequency === 'monthly') {
    const [, , anchorDay] = anchorDate.split('-').map(Number)
    let months = 0
    while (true) {
      // Re-derive from the anchor each time so a February clamp does not
      // permanently drag later months down to the 28th.
      yield withDayOfMonthClamped(
        addMonthsClamped(anchorDate, months),
        anchorDay,
      )
      months += 1
    }
  }

  const [, , anchorDay] = anchorDate.split('-').map(Number)
  const firstDay = anchorDay > 15 ? anchorDay - 15 : anchorDay
  const secondDay = firstDay + 15
  let months = 0
  while (true) {
    const month = addMonthsClamped(anchorDate, months)
    const first = withDayOfMonthClamped(month, firstDay)
    const second = withDayOfMonthClamped(month, secondDay)
    if (first >= anchorDate) yield first
    if (second >= anchorDate && second !== first) yield second
    months += 1
  }
}
