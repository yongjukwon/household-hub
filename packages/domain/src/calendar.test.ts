import { describe, expect, it } from 'vitest'
import { calendarDateInTimeZone, isCalendarTime, type CalendarTime } from './index'

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
  })
})
