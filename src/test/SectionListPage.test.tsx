import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionListPage from '@/routes/SectionListPage'
import { NAV_ITEMS } from '@/components/layout/nav-items'
import { mockFromResult, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

// TemplatePicker (mounted by SectionListPage) pulls in useCreatePage ->
// useHousehold -> useAuth; mock useHousehold so no AuthProvider is needed.
vi.mock('@/hooks/useHousehold', () => ({
  useHousehold: vi.fn(() => ({ data: undefined })),
}))

const notesItem = NAV_ITEMS.find((item) => item.section === 'notes')!

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SectionListPage navItem={notesItem} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SectionListPage', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('renders "No pages yet" when the section has no pages', async () => {
    mockFromResult([])

    renderPage()

    expect(await screen.findByText('No pages yet')).toBeInTheDocument()
  })

  it('renders a distinct error state (not "No pages yet") when the query fails', async () => {
    mockFromResult(null, new Error('RLS says no'))

    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn.t load pages/i)
    expect(screen.queryByText('No pages yet')).not.toBeInTheDocument()
  })
})
