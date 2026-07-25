import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

describe('RequireAuth development behavior', () => {
  afterEach(() => {
    mockedUseAuth.mockReset()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('still requires login when the legacy disable-auth flag is true', async () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_DISABLE_AUTH', 'true')
    vi.resetModules()

    mockedUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    })

    const { RequireAuth } = await import('@/components/auth/RequireAuth')

    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/calendar"
            element={
              <RequireAuth>
                <div>Calendar</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Calendar')).not.toBeInTheDocument()
  })
})
