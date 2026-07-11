import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Secret content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  afterEach(() => {
    mockedUseAuth.mockReset()
  })

  it('renders children when a session exists', () => {
    mockedUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' } } as never,
      user: { id: 'user-1' } as never,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    })

    renderProtected()

    expect(screen.getByText('Secret content')).toBeInTheDocument()
  })

  it('redirects to /login when there is no session', () => {
    mockedUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    })

    renderProtected()

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument()
  })

  it('renders nothing while the session is loading', () => {
    mockedUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: true,
      signIn: vi.fn(),
      signOut: vi.fn(),
    })

    const { container } = renderProtected()

    expect(container.textContent).toBe('')
  })
})
