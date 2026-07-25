import { isPasswordAuthAllowed, type OAuthProvider } from '@household-hub/domain'
import { supabase } from './supabase'

// Production is OAuth-only. A local/preview build may enable the seeded-test-
// account password path with VITE_ENABLE_TEST_AUTH=true; it is never available
// in a production build (isPasswordAuthAllowed requires both conditions).
export const passwordAuthAllowed = isPasswordAuthAllowed({
  isProduction: import.meta.env.PROD,
  testAuthEnabled: import.meta.env.VITE_ENABLE_TEST_AUTH === 'true',
})

/** Provider redirects back here after OAuth; the app finalizes the session. */
export const OAUTH_CALLBACK_PATH = '/auth/callback'

/** Start Google/Apple OAuth, returning to OAUTH_CALLBACK_PATH on success. */
export function signInWithOAuth(provider: OAuthProvider) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}${OAUTH_CALLBACK_PATH}` },
  })
}

/** Seeded-account password sign-in; throws unless the build allows it. */
export async function signInWithTestPassword(email: string, password: string) {
  if (!passwordAuthAllowed) {
    throw new Error('Password sign-in is disabled in this build.')
  }
  return supabase.auth.signInWithPassword({ email, password })
}
