import { describe, expect, it } from 'vitest'
import { isOAuthProvider, isPasswordAuthAllowed, oauthProviders } from './index'

describe('oauth providers', () => {
  it('recognizes exactly Google and Apple', () => {
    expect(oauthProviders).toEqual(['google', 'apple'])
    expect(isOAuthProvider('google')).toBe(true)
    expect(isOAuthProvider('apple')).toBe(true)
    expect(isOAuthProvider('github')).toBe(false)
    expect(isOAuthProvider(1)).toBe(false)
  })
})

describe('password auth policy', () => {
  it('allows password sign-in only in non-production with the test flag', () => {
    expect(
      isPasswordAuthAllowed({ isProduction: false, testAuthEnabled: true }),
    ).toBe(true)
    expect(
      isPasswordAuthAllowed({ isProduction: false, testAuthEnabled: false }),
    ).toBe(false)
    expect(
      isPasswordAuthAllowed({ isProduction: true, testAuthEnabled: true }),
    ).toBe(false)
    expect(
      isPasswordAuthAllowed({ isProduction: true, testAuthEnabled: false }),
    ).toBe(false)
  })
})
