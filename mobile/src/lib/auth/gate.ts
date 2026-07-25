import { useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { resolveAuthRedirect } from './redirect'

/**
 * Pauses/resumes Supabase token refresh with app foreground state, per the
 * documented React Native pattern — a backgrounded app should not keep
 * refreshing.
 */
export function useSupabaseAutoRefresh(): void {
  useEffect(() => {
    const handle = (state: AppStateStatus) => {
      if (state === 'active') void supabase.auth.startAutoRefresh()
      else void supabase.auth.stopAutoRefresh()
    }
    handle(AppState.currentState)
    const sub = AppState.addEventListener('change', handle)
    return () => sub.remove()
  }, [])
}

/**
 * Drives the auth redirect from session state and the active route group. Kept
 * out of the layout component so it can be tested with a real router
 * (`renderRouter`) and a mocked session.
 */
export function useAuthGate(): void {
  const { session, isReady } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    const target = resolveAuthRedirect({
      isReady,
      hasSession: session !== null,
      atLogin: segments[0] === 'login',
    })
    if (target) router.replace(target)
  }, [isReady, session, segments, router])
}
