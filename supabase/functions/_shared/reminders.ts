// Pure reminder-scheduling logic for the calendar-reminder-scheduler function.
//
// The database hands over candidate events (start, timezone, presets, dispatch
// keys already recorded) and this module decides which reminders are due right
// now. Keeping it pure is what makes the timezone and idempotency behavior
// unit-testable without a database or an Expo account.

import { instantToZonedParts, zonedDateTimeToInstant } from './timezone.ts'

/**
 * Minutes before the anchor instant each preset fires.
 *
 * Mirrors `reminderLeadMinutes` in `@household-hub/domain`; the edge runtime
 * cannot import the workspace package, so
 * `src/test/edgeFunctionParity.test.ts` asserts the two agree.
 */
export const reminderLeadMinutesByPreset: Record<string, number | null> = {
  none: null,
  'at-time': 0,
  '10m': 10,
  '1h': 60,
  '1d': 60 * 24,
  '1w': 60 * 24 * 7,
}

/** All-day events have no clock time; their reminders anchor to 09:00 local. */
export const ALL_DAY_ANCHOR_MINUTES = 9 * 60

/** How far past its fire time a reminder is still worth sending. */
export const DEFAULT_GRACE_MINUTES = 60

export type ReminderCandidate = {
  householdId: string
  eventId: string
  title: string
  allDay: boolean
  /** UTC instant for timed events; null for all-day. */
  startAt: string | null
  /** `YYYY-MM-DD` for all-day events; null for timed. */
  startDate: string | null
  eventTimezone: string
  presets: string[] | null
  dispatched: { preset: string; occurrenceStart: string }[]
}

export type DueReminder = {
  householdId: string
  eventId: string
  title: string
  preset: string
  /** Identity of the occurrence being reminded about. */
  occurrenceStart: Date
  fireAt: Date
}

/** The instant an event starts, as the dispatch key records it. */
export function occurrenceStartOf(candidate: ReminderCandidate): Date {
  if (candidate.allDay) {
    if (!candidate.startDate) {
      throw new Error(`All-day event ${candidate.eventId} has no start date`)
    }
    return zonedDateTimeToInstant(
      candidate.startDate,
      0,
      candidate.eventTimezone,
    )
  }
  if (!candidate.startAt) {
    throw new Error(`Timed event ${candidate.eventId} has no start instant`)
  }
  return new Date(candidate.startAt)
}

/** The instant an `at-time` reminder fires; earlier presets subtract from it. */
export function reminderAnchorOf(candidate: ReminderCandidate): Date {
  if (!candidate.allDay) return occurrenceStartOf(candidate)
  if (!candidate.startDate) {
    throw new Error(`All-day event ${candidate.eventId} has no start date`)
  }
  return zonedDateTimeToInstant(
    candidate.startDate,
    ALL_DAY_ANCHOR_MINUTES,
    candidate.eventTimezone,
  )
}

export type DueRemindersOptions = {
  now: Date
  /**
   * Reminders whose fire time has already passed by more than this are dropped
   * rather than delivered late — a scheduler outage should not produce a burst
   * of stale "in 10 minutes" pushes for events that already happened.
   */
  graceMinutes?: number
}

/**
 * Reminders that should be delivered on this run: fire time reached, still
 * inside the grace window, and no dispatch recorded for that
 * (event, preset, occurrence) key yet.
 */
export function dueReminders(
  candidates: ReminderCandidate[],
  { now, graceMinutes = DEFAULT_GRACE_MINUTES }: DueRemindersOptions,
): DueReminder[] {
  const due: DueReminder[] = []
  const earliest = now.getTime() - graceMinutes * 60_000

  for (const candidate of candidates) {
    const presets = candidate.presets ?? []
    if (presets.length === 0) continue

    const occurrenceStart = occurrenceStartOf(candidate)
    const anchor = reminderAnchorOf(candidate)
    const alreadyDispatched = new Set(
      candidate.dispatched.map(
        (entry) =>
          `${entry.preset}@${new Date(entry.occurrenceStart).toISOString()}`,
      ),
    )

    for (const preset of new Set(presets)) {
      const lead = reminderLeadMinutesByPreset[preset]
      if (lead === null || lead === undefined) continue

      const key = `${preset}@${occurrenceStart.toISOString()}`
      if (alreadyDispatched.has(key)) continue

      const fireAt = new Date(anchor.getTime() - lead * 60_000)
      if (fireAt.getTime() > now.getTime()) continue
      if (fireAt.getTime() < earliest) continue

      due.push({
        householdId: candidate.householdId,
        eventId: candidate.eventId,
        title: candidate.title,
        preset,
        occurrenceStart,
        fireAt,
      })
    }
  }

  return due.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
}

/**
 * Event-start window to ask the database for. It has to reach forward past the
 * longest lead (a one-week reminder fires while the event is still a week out)
 * and back over the grace window (an `at-time` reminder for an event that just
 * started is still due).
 */
export function candidateWindow(
  now: Date,
  graceMinutes = DEFAULT_GRACE_MINUTES,
): { windowStart: Date; windowEnd: Date } {
  const maxLead = Math.max(
    ...Object.values(reminderLeadMinutesByPreset).map((lead) => lead ?? 0),
  )
  return {
    windowStart: new Date(now.getTime() - graceMinutes * 60_000),
    // All-day anchors sit up to a day after the stored midnight start, so the
    // forward edge allows for that too.
    windowEnd: new Date(now.getTime() + (maxLead + 24 * 60) * 60_000),
  }
}

/** Human-facing push copy for one due reminder. */
export function reminderPushCopy(
  reminder: DueReminder,
  candidate: ReminderCandidate,
): { title: string; body: string } {
  if (candidate.allDay) {
    return {
      title: reminder.title,
      body:
        reminder.preset === 'at-time'
          ? 'Today'
          : `In ${describeLead(reminder.preset)}`,
    }
  }

  const local = instantToZonedParts(
    occurrenceStartOf(candidate),
    candidate.eventTimezone,
  )
  const clock = `${String(Math.floor(local.minutesOfDay / 60)).padStart(2, '0')}:${String(
    local.minutesOfDay % 60,
  ).padStart(2, '0')}`

  return {
    title: reminder.title,
    body:
      reminder.preset === 'at-time'
        ? `Starting now (${clock})`
        : `In ${describeLead(reminder.preset)} (${clock})`,
  }
}

/** "10 minutes", "1 hour", … for a lead preset. */
export function describeLead(preset: string): string {
  switch (preset) {
    case '10m':
      return '10 minutes'
    case '1h':
      return '1 hour'
    case '1d':
      return '1 day'
    case '1w':
      return '1 week'
    default:
      return preset
  }
}
