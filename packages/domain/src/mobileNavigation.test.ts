import { describe, expect, it } from 'vitest'
import * as domain from './index'

type NavigationContract = {
  DEFAULT_MOBILE_NAVIGATION?: readonly string[]
  isMobileNavigation?: (value: unknown) => boolean
  normalizeMobileNavigation?: (value: unknown) => readonly string[]
}

const navigation = domain as NavigationContract

describe('shared mobile navigation contract', () => {
  it('exports the canonical default and validates exactly three unique destinations', () => {
    expect(navigation.DEFAULT_MOBILE_NAVIGATION)
      .toEqual(['groceries', 'ledger', 'trips'])
    expect(navigation.isMobileNavigation?.(['notes', 'trips', 'groceries']))
      .toBe(true)
    expect(navigation.isMobileNavigation?.(['notes', 'notes', 'groceries']))
      .toBe(false)
    expect(navigation.isMobileNavigation?.(['schedule', 'trips', 'groceries']))
      .toBe(false)
  })

  it('normalizes malformed persisted values to the shared default', () => {
    expect(navigation.normalizeMobileNavigation?.(['notes', 'notes', 'trips']))
      .toEqual(['groceries', 'ledger', 'trips'])
  })
})
