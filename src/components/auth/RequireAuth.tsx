import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

// Dev-only escape hatch: skip the login gate for local testing without an
// account. Requires BOTH a non-production build AND the explicit
// VITE_DISABLE_AUTH=true flag, so a production build always enforces auth.
// Re-enable sign-in by removing the flag (or setting it to anything but
// "true"). Note: this renders the app with NO Supabase session, so
// data-backed screens have no household data — see progress.md.
const AUTH_DISABLED =
  import.meta.env.DEV &&
  import.meta.env.MODE !== 'test' &&
  import.meta.env.VITE_DISABLE_AUTH === 'true'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (AUTH_DISABLED) return <>{children}</>
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  return <>{children}</>
}
