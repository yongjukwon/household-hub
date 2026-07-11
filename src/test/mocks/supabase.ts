import { vi } from 'vitest'

export const mockGetSession = vi.fn()
export const mockOnAuthStateChange = vi.fn()
export const mockSignInWithPassword = vi.fn()
export const mockSignOut = vi.fn()

export const supabase = {
  auth: {
    getSession: mockGetSession,
    onAuthStateChange: mockOnAuthStateChange,
    signInWithPassword: mockSignInWithPassword,
    signOut: mockSignOut,
  },
}

export function resetSupabaseMocks() {
  mockGetSession.mockReset().mockResolvedValue({ data: { session: null } })
  mockOnAuthStateChange.mockReset().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  mockSignInWithPassword.mockReset()
  mockSignOut.mockReset().mockResolvedValue({ error: null })
}
