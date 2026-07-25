import { describe, expect, it } from 'vitest'
import {
  buildMonthGrid,
  datesInSpan,
  monthLabel,
  shiftMonth,
  todayKey,
} from '@/features/calendar/monthGrid'

describe('buildMonthGrid', () => {
  it('returns a full 6×7 grid (42 cells)', () => {
    expect(buildMonthGrid(2026, 7)).toHaveLength(42)
  })

  it('starts on the Sunday on or before the first of the month', () => {
    // July 1 2026 is a Wednesday, so the grid leads with Sun Jun 28.
    const grid = buildMonthGrid(2026, 7)
    expect(grid[0]).toMatchObject({ date: '2026-06-28', inMonth: false })
    expect(grid[3]).toMatchObject({ date: '2026-07-01', day: 1, inMonth: true })
  })

  it('marks the last in-month day and trailing days correctly', () => {
    const grid = buildMonthGrid(2026, 7)
    const july31 = grid.find((c) => c.date === '2026-07-31')
    expect(july31).toMatchObject({ inMonth: true, day: 31 })
    expect(grid.find((c) => c.date === '2026-08-01')?.inMonth).toBe(false)
  })

  it('handles a February that starts on Sunday without an empty lead', () => {
    // Feb 1 2026 is a Sunday.
    const grid = buildMonthGrid(2026, 2)
    expect(grid[0]).toMatchObject({ date: '2026-02-01', inMonth: true })
  })
})

describe('datesInSpan', () => {
  it('is inclusive of both endpoints', () => {
    expect(datesInSpan('2026-07-10', '2026-07-12')).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ])
  })

  it('returns a single date when start equals end', () => {
    expect(datesInSpan('2026-07-10', '2026-07-10')).toEqual(['2026-07-10'])
  })

  it('crosses a month boundary', () => {
    expect(datesInSpan('2026-07-30', '2026-08-01')).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
    ])
  })

  it('falls back to the start date when the range is inverted', () => {
    expect(datesInSpan('2026-07-12', '2026-07-10')).toEqual(['2026-07-12'])
  })
})

describe('shiftMonth', () => {
  it('rolls forward across the year boundary', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month1: 1 })
  })

  it('rolls backward across the year boundary', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month1: 12 })
  })

  it('is a no-op for delta 0', () => {
    expect(shiftMonth(2026, 7, 0)).toEqual({ year: 2026, month1: 7 })
  })
})

describe('monthLabel', () => {
  it('formats month and year', () => {
    expect(monthLabel(2026, 7)).toBe('July 2026')
  })
})

describe('todayKey', () => {
  it('resolves the civil date in the given timezone', () => {
    // 2026-07-11T02:00:00Z is still 2026-07-10 in Toronto (UTC-4).
    const at = new Date('2026-07-11T02:00:00Z')
    expect(todayKey('America/Toronto', at)).toBe('2026-07-10')
    expect(todayKey('UTC', at)).toBe('2026-07-11')
  })
})
