import { describe, expect, it } from 'vitest'
import {
  calendarDateInTimeZone,
  isCalendarTime,
  isReminderPreset,
  reminderLeadMinutes,
  reminderPresets,
  type CalendarTime,
} from './index'

describe('calendar time contracts', () => {
  it('converts timed UTC instants into the viewing device timezone', () => {
    const time = {
      kind: 'timed',
      startsAt: '2026-07-25T00:30:00.000Z',
      endsAt: '2026-07-25T01:30:00.000Z',
      timeZone: 'America/Toronto',
    } as const

    expect(isCalendarTime(time)).toBe(true)
    expect(calendarDateInTimeZone(time as CalendarTime, 'America/Vancouver')).toBe(
      '2026-07-24',
    )
  })

  it('keeps all-day dates fixed regardless of the viewing timezone', () => {
    const time = {
      kind: 'all-day',
      startDate: '2026-07-25',
      endDate: '2026-07-25',
    } as const

    expect(isCalendarTime(time)).toBe(true)
    expect(calendarDateInTimeZone(time as CalendarTime, 'Pacific/Auckland')).toBe(
      '2026-07-25',
    )
  })

  it('rejects timed events with a non-UTC instant or invalid timezone', () => {
    expect(
      isCalendarTime({
        kind: 'timed',
        startsAt: '2026-07-25T00:30:00-07:00',
        endsAt: '2026-07-25T01:30:00.000Z',
        timeZone: 'Not/A_Zone',
      }),
    ).toBe(false)
    expect(
      isCalendarTime({
        kind: 'timed',
        startsAt: '2026-02-30T12:00:00.000Z',
        endsAt: '2026-02-30T13:00:00.000Z',
        timeZone: 'America/Vancouver',
      }),
    ).toBe(false)
  })
})

describe('reminder presets', () => {
  it('recognizes exactly the supported presets', () => {
    expect(reminderPresets).toEqual(['none', 'at-time', '10m', '1h', '1d', '1w'])
    for (const preset of reminderPresets) {
      expect(isReminderPreset(preset)).toBe(true)
    }
    expect(isReminderPreset('30m')).toBe(false)
    expect(isReminderPreset(10)).toBe(false)
  })

  it('maps presets to lead minutes before the event start', () => {
    expect(reminderLeadMinutes('none')).toBeNull()
    expect(reminderLeadMinutes('at-time')).toBe(0)
    expect(reminderLeadMinutes('10m')).toBe(10)
    expect(reminderLeadMinutes('1h')).toBe(60)
    expect(reminderLeadMinutes('1d')).toBe(1440)
    expect(reminderLeadMinutes('1w')).toBe(10080)
  })
})
