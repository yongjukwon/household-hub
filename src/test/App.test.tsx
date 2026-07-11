import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

describe('App', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    window.history.pushState({}, '', '/')
  })

  it('redirects an unauthenticated visitor from / to /login', async () => {
    render(<App />)

    await waitFor(() =>
      expect(screen.getByText('Household Hub')).toBeInTheDocument(),
    )
    expect(window.location.pathname).toBe('/login')
  })
})
