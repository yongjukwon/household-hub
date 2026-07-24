import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { Tables } from '@/types/database'

export type CalendarEvent = Tables<'calendar_events'>
export type RecurrenceFreq = CalendarEvent['recurrence_freq']
type RepeatFreq = Exclude<RecurrenceFreq, 'none'>

/** A concrete dated instance of an event (recurring events expand into many). */
export interface Occurrence {
  event: CalendarEvent
  start: Date
  end: Date
}

/** The six-week (Sunday-start) grid window that displays `month`. */
export function monthGridRange(month: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  }
}

/** Stable per-day map key. */
export const dayKey = (day: Date) => format(day, 'yyyy-MM-dd')

// Safety net so a malformed rule can never spin. The visible window is at most
// ~6 weeks, so even daily recurrence yields <50 in-range occurrences; this cap
// only bounds the fast-forward search, never legitimate output.
const MAX_STEPS = 800

function step(freq: RepeatFreq, from: Date, n: number): Date {
  switch (freq) {
    case 'daily':
      return addDays(from, n)
    case 'weekly':
      return addWeeks(from, n)
    case 'monthly':
      return addMonths(from, n)
    case 'yearly':
      return addYears(from, n)
  }
}

// Approximate number of steps from `start` to `target`, used to fast-forward
// the loop close to the visible window instead of iterating from a start_at
// that may be years in the past. Intentionally undershoots (the caller backs
// off one more step) so the exact overlap checks below never skip a valid
// occurrence.
function approxSteps(freq: RepeatFreq, start: Date, target: Date): number {
  switch (freq) {
    case 'daily':
      return differenceInCalendarDays(target, start)
    case 'weekly':
      return Math.floor(differenceInCalendarDays(target, start) / 7)
    case 'monthly':
      return differenceInCalendarMonths(target, start)
    case 'yearly':
      return differenceInCalendarYears(target, start)
  }
}

/** Parse a 'YYYY-MM-DD' date column as local midnight (not UTC). */
function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Expand a set of events into concrete occurrences overlapping
 * [rangeStart, rangeEnd], sorted by start. Non-recurring events yield at most
 * one; recurring events step by their frequency, preserving each occurrence's
 * duration, stopping at `recurrence_until` (inclusive, by date) or the range.
 */
export function expandOccurrences(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const out: Occurrence[] = []

  for (const event of events) {
    const start = new Date(event.start_at)
    const end = new Date(event.end_at)
    const duration = Math.max(0, end.getTime() - start.getTime())

    if (event.recurrence_freq === 'none') {
      if (end >= rangeStart && start <= rangeEnd) {
        out.push({ event, start, end })
      }
      continue
    }

    // recurrence_until is an inclusive last date; allow an occurrence that
    // starts anytime on that day.
    const untilEnd = event.recurrence_until
      ? parseLocalDate(event.recurrence_until).getTime() + 24 * 60 * 60 * 1000 - 1
      : null

    // First candidate that could still overlap the range starts no earlier
    // than rangeStart - duration.
    const target = new Date(rangeStart.getTime() - duration)
    let k = Math.max(0, approxSteps(event.recurrence_freq, start, target) - 1)

    for (let i = 0; i < MAX_STEPS; i++, k++) {
      const occStart = step(event.recurrence_freq, start, k)
      if (occStart.getTime() > rangeEnd.getTime()) break
      if (untilEnd !== null && occStart.getTime() > untilEnd) break
      const occEnd = new Date(occStart.getTime() + duration)
      if (occEnd >= rangeStart && occStart <= rangeEnd) {
        out.push({ event, start: occStart, end: occEnd })
      }
    }
  }

  out.sort((a, b) => a.start.getTime() - b.start.getTime())
  return out
}

// --- Owner attribution colors ---------------------------------------------

/** Distinct, dot-legible hues; Shared ties to the app's amber accent family. */
const COLOR_A = '#3b5bdb' // indigo
const COLOR_B = '#c2255c' // raspberry
const COLOR_SHARED = '#d9a400' // deep gold (brand-adjacent)

export interface OwnerColors {
  /** Color for an event's owner_id (null = shared). */
  colorFor: (ownerId: string | null) => string
  /** Display label for an event's owner_id ("You" / name / "Shared"). */
  labelFor: (ownerId: string | null) => string
  /** Legend entries in display order: the two members, then Shared. */
  legend: { label: string; color: string }[]
}

/**
 * Deterministically map the (exactly two) household members to two colors by
 * sorted user id, plus a third for Shared. Stable across sessions/devices so
 * both partners see the same person in the same color.
 */
export function buildOwnerColors(
  members: { userId: string; displayName: string }[],
  currentUserId: string | null,
): OwnerColors {
  const sorted = [...members].sort((a, b) => a.userId.localeCompare(b.userId))
  const palette = [COLOR_A, COLOR_B]
  const byUser = new Map<string, string>()
  sorted.forEach((m, i) => byUser.set(m.userId, palette[i] ?? COLOR_A))

  const colorFor = (ownerId: string | null) =>
    ownerId === null ? COLOR_SHARED : (byUser.get(ownerId) ?? COLOR_SHARED)

  const labelFor = (ownerId: string | null) => {
    if (ownerId === null) return 'Shared'
    if (ownerId === currentUserId) return 'You'
    return members.find((m) => m.userId === ownerId)?.displayName ?? 'Shared'
  }

  const legend = [
    ...sorted.map((m) => ({
      label: m.userId === currentUserId ? 'You' : m.displayName,
      color: byUser.get(m.userId) ?? COLOR_A,
    })),
    { label: 'Shared', color: COLOR_SHARED },
  ]

  return { colorFor, labelFor, legend }
}
