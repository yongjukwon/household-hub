import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { LoginForm } from '@/components/auth/LoginForm'
import {
  mockSignInWithPassword,
  resetSupabaseMocks,
} from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

function renderLoginForm() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: email },
  })
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
}

describe('LoginForm', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('displays a friendly error message on failed sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })

    renderLoginForm()

    await fillAndSubmit('usera@test.local', 'wrong-password')

    await waitFor(() =>
      expect(
        screen.getByText('Incorrect email or password.'),
      ).toBeInTheDocument(),
    )
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'usera@test.local',
      password: 'wrong-password',
    })
  })

  it('shows a connection error and re-enables the button when sign-in rejects', async () => {
    // A network-level failure (fetch throwing on a flaky connection) rejects
    // the promise instead of resolving with { error }.
    mockSignInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))

    renderLoginForm()

    await fillAndSubmit('usera@test.local', 'password123')

    await waitFor(() =>
      expect(
        screen.getByText(
          'Couldn’t reach the server — check your connection and try again.',
        ),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('navigates to / on successful sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } },
      error: null,
    })

    renderLoginForm()

    await fillAndSubmit('usera@test.local', 'password123')

    await waitFor(() =>
      expect(screen.getByText('Home Page')).toBeInTheDocument(),
    )
  })
})
