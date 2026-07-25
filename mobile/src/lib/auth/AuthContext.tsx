import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { supabase } from '@/lib/supabase'

export interface AuthState {
  session: Session | null
  /** True once the initial session load has resolved (from AsyncStorage). */
  isReady: boolean
}

const AuthContext = createContext<AuthState>({ session: null, isReady: false })

/**
 * Tracks the Supabase session for the whole app. It seeds from the persisted
 * session on mount and then follows `onAuthStateChange`, so a sign-in, sign-out,
 * token refresh, or OAuth deep-link exchange all flow through one place.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setIsReady(true)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setIsReady(true)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ session, isReady }),
    [session, isReady],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
