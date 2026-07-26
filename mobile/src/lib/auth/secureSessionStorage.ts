import type { SupportedStorage } from '@supabase/supabase-js'

import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from '@/lib/secure'

/**
 * Supabase auth storage backed by iOS Keychain / Android Keystore. React Query
 * data belongs in SQLite, but refresh tokens and session credentials do not.
 */
export const secureSessionStorage: SupportedStorage = {
  getItem: getSecureItem,
  setItem: setSecureItem,
  removeItem: deleteSecureItem,
}
