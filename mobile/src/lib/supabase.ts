import { createClient } from '@supabase/supabase-js'

import { secureSessionStorage } from './auth/secureSessionStorage'
import { supabaseAnonKey, supabaseUrl } from './env'
import type { Database } from '@/types/database'

/**
 * Native Supabase client.
 *
 * The session is persisted in Keychain / Keystore, so a signed-in user stays
 * signed in across app launches without putting refresh tokens in the general
 * app key-value store. `detectSessionInUrl` is false because React Native
 * has no URL bar; OAuth returns through the `householdhub://` deep link
 * instead, which is exchanged for a session explicitly (see `auth/oauth.ts`).
 *
 * Token auto-refresh is paused/resumed against `AppState` in the root layout so
 * a backgrounded app does not burn refreshes, matching Supabase's documented
 * React Native pattern.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
