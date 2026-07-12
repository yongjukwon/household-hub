import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionListPage from '@/routes/SectionListPage'
import { NAV_ITEMS } from '@/components/layout/nav-items'
import { mockFrom, mockFromResult, resetSupabaseMocks } from './mocks/supabase'

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

const onePage = {
  id: 'page-1',
  household_id: 'household-1',
  section: 'notes' as const,
  template: 'blank' as const,
  title: 'Groceries',
  content: { type: 'doc', content: [] },
  created_by: 'user-1',
  archived: false,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

// The list load (select) succeeds with a page; the delete (delete) fails —
// lets a test drive "list loaded fine, then a delete of one of its rows
// fails" without one mockFromResult call clobbering the other's response.
function mockListOkDeleteFails() {
  mockFrom.mockImplementation(() => {
    let isDelete = false
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      delete: vi.fn(() => {
        isDelete = true
        return builder
      }),
      then: (
        onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
      ) =>
        Promise.resolve(
          isDelete
            ? { data: null, error: new Error('RLS says no') }
            : { data: [onePage], error: null },
        ).then(onFulfilled),
    }
    return builder
  })
}

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

  it('surfaces a failed delete inline (same alert pattern as load/create errors) instead of failing silently', async () => {
    mockListOkDeleteFails()

    renderPage()

    expect(await screen.findByText('Groceries')).toBeInTheDocument()

    // Open the row's delete menu via right-click (desktop path — the
    // long-press path is covered by PageCard's own tests) and select
    // "Delete page".
    fireEvent.contextMenu(screen.getByRole('link'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete page' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn.t delete the page/i)
    // The list itself is still shown — a failed delete isn't a load error.
    expect(screen.getByText('Groceries')).toBeInTheDocument()
  })
})
