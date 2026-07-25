import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

import { supabaseAnonKey, supabaseUrl } from './env'

/**
 * Native Supabase client.
 *
 * The session is persisted to AsyncStorage — the same durable, reload-safe
 * store the web client gets from the browser, so a signed-in user stays signed
 * in across app launches. `detectSessionInUrl` is false because React Native
 * has no URL bar; OAuth returns through the `householdhub://` deep link
 * instead, which is exchanged for a session explicitly (see `auth/oauth.ts`).
 *
 * Token auto-refresh is paused/resumed against `AppState` in the root layout so
 * a backgrounded app does not burn refreshes, matching Supabase's documented
 * React Native pattern.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
