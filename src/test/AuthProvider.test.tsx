import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { useAuth } from '@/hooks/useAuth'
import {
  mockGetSession,
  mockOnAuthStateChange,
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

describe('AuthProvider', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('clears the React Query cache when a SIGNED_OUT event fires', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } })
    let authChangeCallback:
      | ((event: string, session: typeof fakeSession | null) => void)
      | undefined
    mockOnAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    const queryClient = new QueryClient()
    function wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      )
    }

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Simulate data left over from the previously signed-in user.
    queryClient.setQueryData(['household'], { id: 'prev-user-household' })
    expect(queryClient.getQueryData(['household'])).toBeDefined()

    act(() => {
      authChangeCallback?.('SIGNED_OUT', null)
    })

    await waitFor(() =>
      expect(queryClient.getQueryData(['household'])).toBeUndefined(),
    )
  })
})
