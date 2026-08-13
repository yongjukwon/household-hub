import {
  DEFAULT_MOBILE_NAVIGATION,
  isMobileNavigation,
  normalizeMobileNavigation,
  mobileTabDestinations,
  moveMobileDestination,
  omittedDestination,
  replaceMobileDestination,
} from './mobileNavigation'

describe('mobile navigation', () => {
  it('accepts exactly three unique configurable destinations', () => {
    expect(isMobileNavigation(['groceries', 'ledger', 'trips'])).toBe(true)
    expect(isMobileNavigation(['notes', 'groceries', 'ledger'])).toBe(true)
    expect(isMobileNavigation(['groceries', 'groceries', 'trips'])).toBe(false)
    expect(isMobileNavigation(['schedule', 'ledger', 'trips'])).toBe(false)
    expect(isMobileNavigation(['groceries', 'ledger'])).toBe(false)
  })

  it('keeps Schedule first and More fifth while preserving the saved order', () => {
    expect(DEFAULT_MOBILE_NAVIGATION).toEqual(['groceries', 'ledger', 'trips'])
    expect(mobileTabDestinations(['notes', 'trips', 'groceries']).map((item) => item.key))
      .toEqual(['schedule', 'notes', 'trips', 'groceries', 'more'])
    expect(omittedDestination(['notes', 'trips', 'groceries'])).toBe('ledger')
  })

  it('falls back to the default for malformed stored values', () => {
    expect(normalizeMobileNavigation(['notes', 'ledger', 'groceries']))
      .toEqual(['notes', 'ledger', 'groceries'])
    expect(normalizeMobileNavigation(['notes', 'notes', 'trips']))
      .toEqual(DEFAULT_MOBILE_NAVIGATION)
    expect(normalizeMobileNavigation(null)).toEqual(DEFAULT_MOBILE_NAVIGATION)
  })

  it('moves and replaces only configurable slots', () => {
    expect(moveMobileDestination(['groceries', 'ledger', 'trips'], 1, -1))
      .toEqual(['ledger', 'groceries', 'trips'])
    expect(moveMobileDestination(['groceries', 'ledger', 'trips'], 0, -1))
      .toEqual(['groceries', 'ledger', 'trips'])
    expect(replaceMobileDestination(['groceries', 'ledger', 'trips'], 1))
      .toEqual(['groceries', 'notes', 'trips'])
  })
})
