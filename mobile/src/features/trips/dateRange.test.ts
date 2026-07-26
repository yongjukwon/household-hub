import {
  defaultTripDateRange,
  formatTripDateRange,
  monthFromDateKey,
  nextCivilDate,
  selectTripRangeDate,
} from './dateRange'

describe('Trip civil-date ranges', () => {
  it('defaults a new Trip to today through tomorrow', () => {
    expect(defaultTripDateRange(new Date(2026, 6, 26, 20, 0))).toEqual({
      startDate: '2026-07-26',
      endDate: '2026-07-27',
    })
  })

  it('advances safely across month and year boundaries', () => {
    expect(nextCivilDate('2026-07-31')).toBe('2026-08-01')
    expect(nextCivilDate('2026-12-31')).toBe('2027-01-01')
  })

  it('starts a fresh draft when a completed range receives its first tap', () => {
    expect(
      selectTripRangeDate(
        { startDate: '2026-07-26', endDate: '2026-07-27' },
        '2026-08-03',
      ),
    ).toEqual({
      startDate: '2026-08-03',
      endDate: null,
    })
  })

  it('allows a one-day Trip when the second tap matches Start', () => {
    expect(
      selectTripRangeDate(
        { startDate: '2026-08-03', endDate: null },
        '2026-08-03',
      ),
    ).toEqual({
      startDate: '2026-08-03',
      endDate: '2026-08-03',
    })
  })

  it('completes a forward range', () => {
    expect(
      selectTripRangeDate(
        { startDate: '2026-08-03', endDate: null },
        '2026-08-06',
      ),
    ).toEqual({
      startDate: '2026-08-03',
      endDate: '2026-08-06',
    })
  })

  it('restarts when the second tap precedes Start', () => {
    expect(
      selectTripRangeDate(
        { startDate: '2026-08-03', endDate: null },
        '2026-08-01',
      ),
    ).toEqual({
      startDate: '2026-08-01',
      endDate: null,
    })
  })

  it('formats and locates a stored range without timezone conversion', () => {
    expect(formatTripDateRange('2026-07-26', '2026-08-02')).toBe(
      'Jul 26, 2026 – Aug 2, 2026',
    )
    expect(monthFromDateKey('2026-12-31')).toEqual({
      year: 2026,
      month1: 12,
    })
  })
})
