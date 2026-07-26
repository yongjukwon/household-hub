import {
  CALENDAR_DATE_SURFACE_SIZE,
  CALENDAR_DAY_CELL_HEIGHT,
  CALENDAR_MONTH_HEADER_BOTTOM_SPACING,
  CALENDAR_TODAY_RADIUS,
} from './layout'

describe('Calendar month layout', () => {
  it('uses reference-height date rows', () => {
    expect(CALENDAR_DAY_CELL_HEIGHT).toBe(48)
  })

  it('keeps enough vertical room for a centered date and independent event dot', () => {
    expect(CALENDAR_DAY_CELL_HEIGHT).toBeGreaterThan(
      CALENDAR_DATE_SURFACE_SIZE,
    )
  })

  it('uses equal dimensions and a half-size radius for today', () => {
    expect(CALENDAR_DATE_SURFACE_SIZE).toBe(32)
    expect(CALENDAR_TODAY_RADIUS).toBe(16)
  })

  it('balances the month header against the card inset', () => {
    expect(CALENDAR_MONTH_HEADER_BOTTOM_SPACING).toBe(14)
  })
})
