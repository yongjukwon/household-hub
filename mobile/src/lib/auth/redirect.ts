export type AuthRedirect = '/login' | '/' | null

/**
 * Decides where the router should send the user based on auth state and the
 * route they are on. Kept pure so the gate can be tested without a navigator:
 * the root layout wires the real `useSegments`/`useRouter` to it.
 *
 * - Nothing happens until the initial session load resolves, so we never flash
 *   the login screen for an already-signed-in user on cold start.
 * - A signed-out user anywhere but login is sent to login.
 * - A signed-in user sitting on login is sent to the default route (Calendar).
 */
export function resolveAuthRedirect(params: {
  isReady: boolean
  hasSession: boolean
  atLogin: boolean
}): AuthRedirect {
  if (!params.isReady) return null
  if (!params.hasSession && !params.atLogin) return '/login'
  if (params.hasSession && params.atLogin) return '/'
  return null
}
