import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

import { useHousehold } from '@/hooks/useHousehold'
const mockUseHousehold = vi.mocked(useHousehold)

const notesItem = NAV_ITEMS.find((item) => item.section === 'notes')!
const tripsItem = NAV_ITEMS.find((item) => item.section === 'trip')!
const budgetItem = NAV_ITEMS.find((item) => item.section === 'budget')!

const onePage = {
  id: 'page-1',
  household_id: 'household-1',
  section: 'notes' as const,
  template: 'blank' as const,
  title: 'Groceries',
  content: { type: 'doc', content: [] },
  created_by: 'user-1',
  archived: false,
  start_date: null,
  end_date: null,
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

  it('creates a page with the current section template after switching sections (no stale template)', async () => {
    // Regression: all four section routes render the same SectionListPage at
    // the same position, so React reuses the instance across navigation. If
    // TemplatePicker's template state isn't keyed to the section, switching
    // Trips -> Budget leaves it on 'trip', producing a budget-section page
    // with a trip template (which then renders the Trip planner under Budget).
    mockUseHousehold.mockReturnValue({
      data: { id: 'household-1', name: 'Our Household', members: [] },
    } as never)

    let insertPayload: Record<string, unknown> | null = null
    const created = {
      ...onePage,
      id: 'new-page',
      section: 'budget',
      template: 'budget',
      title: '202706',
    }
    mockFrom.mockImplementation(() => {
      let isInsert = false
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        insert: vi.fn((payload: Record<string, unknown>) => {
          isInsert = true
          insertPayload = payload
          return builder
        }),
        single: vi.fn(() => Promise.resolve({ data: created, error: null })),
        then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) =>
          Promise.resolve(
            isInsert
              ? { data: created, error: null }
              : { data: [], error: null },
          ).then(onFulfilled),
      }
      return builder
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const view = (navItem: typeof tripsItem) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SectionListPage navItem={navItem} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    const { rerender } = render(view(tripsItem))
    // Simulate navigating Trips -> Budget: same instance, new navItem prop.
    rerender(view(budgetItem))

    fireEvent.click(screen.getByRole('button', { name: 'New Budget page' }))
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: '202706' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(insertPayload).not.toBeNull())
    expect(insertPayload).toMatchObject({
      section: 'budget',
      template: 'budget',
    })
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
