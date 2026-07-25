import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'

import { supabase } from '@/lib/supabase'
import { parseAuthCallback } from './callbackUrl'

// Dismisses the auth popup automatically when the browser redirects back.
WebBrowser.maybeCompleteAuthSession()

export type OAuthProvider = 'google' | 'apple'

/** `householdhub://auth/callback`, matching the app scheme in app.json. */
export const authRedirectUri = Linking.createURL('auth/callback')

export type OAuthOutcome =
  | { status: 'signed-in' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

/**
 * Runs the PKCE OAuth flow. Supabase returns an authorization URL that we open
 * in an in-app browser session; the provider redirects back to
 * `householdhub://auth/callback?code=…`, and that code is exchanged for a
 * session. `AuthProvider` then picks the session up via `onAuthStateChange`.
 *
 * Production auth is Google and Apple only; email/password stays a local/test
 * affordance (see the login screen).
 */
export async function signInWithProvider(
  provider: OAuthProvider,
): Promise<OAuthOutcome> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authRedirectUri, skipBrowserRedirect: true },
  })
  if (error) return { status: 'error', message: error.message }
  if (!data.url) return { status: 'error', message: 'No OAuth URL returned' }

  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    authRedirectUri,
  )
  if (result.type !== 'success') return { status: 'cancelled' }

  return exchangeCallbackUrl(result.url)
}

/**
 * Exchanges a callback URL for a session. Exported so a cold-start deep link
 * (app opened by the OAuth redirect) can reuse the same path as the in-app
 * browser result.
 */
export async function exchangeCallbackUrl(url: string): Promise<OAuthOutcome> {
  const { code, error, errorDescription } = parseAuthCallback(url)
  if (error) return { status: 'error', message: errorDescription ?? error }
  if (!code) return { status: 'cancelled' }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  )
  if (exchangeError) return { status: 'error', message: exchangeError.message }
  return { status: 'signed-in' }
}
