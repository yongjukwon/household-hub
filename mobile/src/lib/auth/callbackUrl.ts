export interface AuthCallback {
  /** PKCE authorization code to exchange for a session; null when absent. */
  code: string | null
  /** OAuth error code (e.g. `access_denied`); null when the flow succeeded. */
  error: string | null
  errorDescription: string | null
}

/**
 * Pulls the auth result out of a `householdhub://` OAuth callback URL. Pure and
 * defensive so the deep-link handler can trust it: a malformed or unrelated
 * deep link parses to all-nulls rather than throwing.
 */
export function parseAuthCallback(url: string): AuthCallback {
  const empty: AuthCallback = { code: null, error: null, errorDescription: null }

  let query: URLSearchParams
  try {
    // React Native's URL supports custom schemes; the query is what we need.
    const parsed = new URL(url)
    query = parsed.searchParams
  } catch {
    return empty
  }

  return {
    code: query.get('code'),
    error: query.get('error'),
    errorDescription: query.get('error_description'),
  }
}
