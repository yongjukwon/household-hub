import { resolveAuthRedirect } from './redirect'

describe('resolveAuthRedirect', () => {
  it('does nothing until auth state has loaded', () => {
    expect(
      resolveAuthRedirect({ isReady: false, hasSession: false, atLogin: false }),
    ).toBeNull()
    expect(
      resolveAuthRedirect({ isReady: false, hasSession: true, atLogin: true }),
    ).toBeNull()
  })

  it('sends a signed-out user on a protected route to login', () => {
    expect(
      resolveAuthRedirect({ isReady: true, hasSession: false, atLogin: false }),
    ).toBe('/login')
  })

  it('leaves a signed-out user already on login alone', () => {
    expect(
      resolveAuthRedirect({ isReady: true, hasSession: false, atLogin: true }),
    ).toBeNull()
  })

  it('sends a signed-in user away from login to the default route', () => {
    expect(
      resolveAuthRedirect({ isReady: true, hasSession: true, atLogin: true }),
    ).toBe('/')
  })

  it('leaves a signed-in user on a protected route alone', () => {
    expect(
      resolveAuthRedirect({ isReady: true, hasSession: true, atLogin: false }),
    ).toBeNull()
  })
})
