import type { CalendarTime } from '@household-hub/domain'

import { eventDayInTimeZone, formatCents, formatTimeInZone } from './format'

describe('currency presentation', () => {
  it('formats CAD integer cents with a narrow symbol and no conversion', () => {
    expect(formatCents(180000, 'CAD')).toBe('$1,800.00')
  })

  it('formats a foreign currency in its own units, never converted', () => {
    expect(formatCents(7000, 'GBP')).toBe('£70.00')
  })

  it('formats zero and sub-dollar amounts', () => {
    expect(formatCents(0, 'CAD')).toBe('$0.00')
    expect(formatCents(5, 'CAD')).toBe('$0.05')
  })
})

describe('timezone helpers', () => {
  const timed = {
    kind: 'timed',
    // 2026-01-02 03:00 UTC — still Jan 1 in Toronto (UTC-5).
    startsAt: '2026-01-02T03:00:00.000Z',
    endsAt: '2026-01-02T04:00:00.000Z',
    timeZone: 'America/Toronto',
  } as CalendarTime

  it('places a UTC instant on the correct local calendar day', () => {
    expect(eventDayInTimeZone(timed, 'America/Toronto')).toBe('2026-01-01')
    expect(eventDayInTimeZone(timed, 'UTC')).toBe('2026-01-02')
  })

  it('keeps an all-day event on its stored date regardless of zone', () => {
    const allDay: CalendarTime = {
      kind: 'all-day',
      startDate: '2026-03-14',
      endDate: '2026-03-14',
    }
    expect(eventDayInTimeZone(allDay, 'Asia/Seoul')).toBe('2026-03-14')
  })

  it('formats wall-clock time in the viewing zone', () => {
    // en-CA renders lowercase day-period markers.
    expect(formatTimeInZone('2026-01-02T03:00:00.000Z', 'UTC')).toBe(
      '3:00 a.m.',
    )
    expect(
      formatTimeInZone('2026-01-02T03:00:00.000Z', 'America/Toronto'),
    ).toBe('10:00 p.m.')
  })
})
