import { parseAuthCallback } from './callbackUrl'

describe('parseAuthCallback', () => {
  it('extracts a PKCE code from the deep-link callback', () => {
    expect(
      parseAuthCallback('householdhub://auth/callback?code=abc123'),
    ).toEqual({ code: 'abc123', error: null, errorDescription: null })
  })

  it('extracts an OAuth error and description', () => {
    expect(
      parseAuthCallback(
        'householdhub://auth/callback?error=access_denied&error_description=User%20cancelled',
      ),
    ).toEqual({
      code: null,
      error: 'access_denied',
      errorDescription: 'User cancelled',
    })
  })

  it('returns nulls for a callback with no auth params', () => {
    expect(parseAuthCallback('householdhub://auth/callback')).toEqual({
      code: null,
      error: null,
      errorDescription: null,
    })
  })

  it('returns nulls for an unparseable url', () => {
    expect(parseAuthCallback('not a url')).toEqual({
      code: null,
      error: null,
      errorDescription: null,
    })
  })

  it('ignores non-auth deep links (no code, no error)', () => {
    expect(
      parseAuthCallback('householdhub://calendar?event=xyz'),
    ).toEqual({ code: null, error: null, errorDescription: null })
  })
})
