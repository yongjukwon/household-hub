import { type TimeZone, isIsoDateTime, isRecord, isTimeZone } from './validation'

export type TimedCalendarTime = {
  kind: 'timed'
  startsAt: string
  endsAt: string
  timeZone: TimeZone
}

export type AllDayCalendarTime = {
  kind: 'all-day'
  startDate: string
  endDate: string
}

export type CalendarTime = TimedCalendarTime | AllDayCalendarTime

/** Timed events move with the viewer; all-day events retain their date. */
export function calendarDateInTimeZone(
  time: CalendarTime,
  viewingTimeZone: TimeZone | string,
): string {
  if (time.kind === 'all-day') return time.startDate

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: viewingTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time.startsAt))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value

  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isCalendarTime(value: unknown): value is CalendarTime {
  if (!isRecord(value)) return false

  if (value.kind === 'timed') {
    return (
      isUtcInstant(value.startsAt) &&
      isUtcInstant(value.endsAt) &&
      Date.parse(value.endsAt) > Date.parse(value.startsAt) &&
      isTimeZone(value.timeZone)
    )
  }

  return (
    value.kind === 'all-day' &&
    isDateOnly(value.startDate) &&
    isDateOnly(value.endDate) &&
    value.endDate >= value.startDate
  )
}

/**
 * Reminder lead times offered per event. `none` disables reminders, `at-time`
 * fires at the event start; the rest fire the labeled amount before it.
 * All-day events resolve `at-time`/offsets against 09:00 in the event timezone
 * (that resolution is a scheduling concern, handled server-side).
 */
export const reminderPresets = ['none', 'at-time', '10m', '1h', '1d', '1w'] as const

export type ReminderPreset = (typeof reminderPresets)[number]

export function isReminderPreset(value: unknown): value is ReminderPreset {
  return (
    typeof value === 'string' &&
    reminderPresets.includes(value as ReminderPreset)
  )
}

/** Minutes before event start a preset fires, or null when there is no reminder. */
export function reminderLeadMinutes(preset: ReminderPreset): number | null {
  switch (preset) {
    case 'none':
      return null
    case 'at-time':
      return 0
    case '10m':
      return 10
    case '1h':
      return 60
    case '1d':
      return 60 * 24
    case '1w':
      return 60 * 24 * 7
  }
}

function isUtcInstant(value: unknown): value is string {
  return typeof value === 'string' && value.endsWith('Z') && isIsoDateTime(value)
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

// --- Owner attribution colors ---------------------------------------------

/** Distinct, dot-legible hues; Shared ties to the app's amber accent family. */
const OWNER_COLOR_A = '#3b5bdb' // indigo
const OWNER_COLOR_B = '#c2255c' // raspberry
const OWNER_COLOR_SHARED = '#d9a400' // deep gold (brand-adjacent)

export interface OwnerColors {
  /** Color for an event's owner_id (null = shared). */
  colorFor: (ownerId: string | null) => string
  /** Display label for an event's owner_id ("You" / name / "Shared"). */
  labelFor: (ownerId: string | null) => string
}

/**
 * Deterministically map the (exactly two) household members to two colors by
 * sorted user id, plus a third for Shared. Stable across sessions/devices so
 * both partners see the same person in the same color on web and native.
 */
export function buildOwnerColors(
  members: { userId: string; displayName: string }[],
  currentUserId: string | null,
): OwnerColors {
  const sorted = [...members].sort((a, b) => a.userId.localeCompare(b.userId))
  const palette = [OWNER_COLOR_A, OWNER_COLOR_B]
  const byUser = new Map<string, string>()
  sorted.forEach((m, i) => byUser.set(m.userId, palette[i] ?? OWNER_COLOR_A))

  const colorFor = (ownerId: string | null) =>
    ownerId === null ? OWNER_COLOR_SHARED : (byUser.get(ownerId) ?? OWNER_COLOR_SHARED)

  const labelFor = (ownerId: string | null) => {
    if (ownerId === null) return 'Shared'
    if (ownerId === currentUserId) return 'You'
    return members.find((m) => m.userId === ownerId)?.displayName ?? 'Shared'
  }

  return { colorFor, labelFor }
}
