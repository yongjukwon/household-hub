import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PageCard } from '@/components/pages/PageCard'
import type { PageRow } from '@/hooks/usePages'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

const page: PageRow = {
  id: 'page-1',
  household_id: 'household-1',
  section: 'notes',
  template: 'blank',
  title: 'Groceries',
  content: { type: 'doc', content: [] },
  created_by: 'user-1',
  archived: false,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderCard(onDelete: (id: string) => void = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/notes']}>
        <LocationDisplay />
        <Routes>
          <Route
            path="/notes"
            element={
              <PageCard page={page} sectionPath="/notes" onDelete={onDelete} />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PageCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('long-press opens the delete menu and does not navigate', () => {
    const onDelete = vi.fn()
    renderCard(onDelete)

    const link = screen.getByRole('link')
    fireEvent.touchStart(link)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    fireEvent.touchEnd(link)

    expect(
      screen.getByRole('menuitem', { name: 'Delete page' }),
    ).toBeInTheDocument()

    // Simulate the synthetic click a real touch device fires after
    // touchend — this must not be allowed to navigate into the page.
    fireEvent.click(link)

    expect(screen.getByTestId('location').textContent).toBe('/notes')
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('invokes the delete callback when "Delete page" is selected from a long-press menu', async () => {
    const onDelete = vi.fn()
    renderCard(onDelete)

    const link = screen.getByRole('link')
    fireEvent.touchStart(link)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    fireEvent.touchEnd(link)

    // Switch to real timers for the menu-item interaction: userEvent
    // schedules its own timers internally and this repo's other
    // DropdownMenu tests (FormatToolbar.test.tsx) drive menu items via
    // userEvent rather than a raw fireEvent.click.
    vi.useRealTimers()
    const user = userEvent.setup()
    await user.click(screen.getByRole('menuitem', { name: 'Delete page' }))

    expect(onDelete).toHaveBeenCalledWith('page-1')
  })

  it('offers only Delete and Cancel (renaming moved to the page header)', () => {
    renderCard()

    const link = screen.getByRole('link')
    fireEvent.touchStart(link)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    fireEvent.touchEnd(link)

    expect(
      screen.getByRole('menuitem', { name: 'Delete page' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Rename' }),
    ).not.toBeInTheDocument()
  })

  it('a short tap (no long-press) navigates normally', () => {
    renderCard()

    const link = screen.getByRole('link')
    fireEvent.touchStart(link)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.touchEnd(link)
    fireEvent.click(link)

    expect(screen.getByTestId('location').textContent).toBe('/notes/page-1')
  })

  it('clears the long-press timer on unmount so it cannot fire after the component is gone', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout')
    const { unmount } = renderCard()

    const link = screen.getByRole('link')
    fireEvent.touchStart(link)

    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})
