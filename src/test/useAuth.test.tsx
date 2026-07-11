import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { useAuth } from '@/hooks/useAuth'
import {
  mockGetSession,
  mockOnAuthStateChange,
  mockSignOut,
  resetSupabaseMocks,
} from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

const fakeSession = {
  access_token: 'token',
  user: { id: 'user-1', email: 'usera@test.local' },
} as unknown as import('@supabase/supabase-js').Session

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

describe('useAuth', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('exposes the session from getSession once it resolves', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } })

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.session).toEqual(fakeSession)
    expect(result.current.user).toEqual(fakeSession.user)
  })

  it('updates session when onAuthStateChange fires', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    let authChangeCallback:
      | ((event: string, session: typeof fakeSession | null) => void)
      | undefined
    mockOnAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()

    act(() => {
      authChangeCallback?.('SIGNED_IN', fakeSession)
    })

    await waitFor(() => expect(result.current.session).toEqual(fakeSession))
    expect(result.current.user).toEqual(fakeSession.user)
  })

  it('signOut calls supabase.auth.signOut and clears the session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } })
    let authChangeCallback:
      | ((event: string, session: typeof fakeSession | null) => void)
      | undefined
    mockOnAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockSignOut).toHaveBeenCalledTimes(1)

    // Real supabase clients fire onAuthStateChange with a null session after
    // signOut resolves; simulate that to confirm the context clears itself.
    act(() => {
      authChangeCallback?.('SIGNED_OUT', null)
    })

    await waitFor(() => expect(result.current.session).toBeNull())
    expect(result.current.user).toBeNull()
  })
})
