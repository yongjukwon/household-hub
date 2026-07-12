import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PageView from '@/routes/PageView'
import { mockFrom, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

function pageWithDoc(id: string, title: string, text: string) {
  return {
    id,
    household_id: 'household-1',
    section: 'notes' as const,
    template: 'blank' as const,
    title,
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    },
    created_by: 'user-1',
    archived: false,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-10T00:00:00.000Z',
  }
}

const pageA = pageWithDoc('page-a', 'Alpha page', 'Alpha doc text')
const pageB = pageWithDoc('page-b', 'Beta page', 'Beta doc text')
const pagesById: Record<string, typeof pageA> = {
  'page-a': pageA,
  'page-b': pageB,
}

// Resolves usePage's `.eq('id', ...).single()` per requested id, so both
// pages' (background) refetches get consistent data.
function mockPagesById() {
  mockFrom.mockImplementation(() => {
    let requestedId: string | undefined
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: string) => {
        if (column === 'id') requestedId = value
        return builder
      }),
      single: vi.fn(() =>
        Promise.resolve({
          data: requestedId ? (pagesById[requestedId] ?? null) : null,
          error: null,
        }),
      ),
    }
    return builder
  })
}

function GoToPageB() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/notes/page-b')}>
      Go to page B
    </button>
  )
}

describe('PageView', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    mockPagesById()
  })

  it("shows the new page's document when pageId changes on the shared route without an unmount (keyed remount)", async () => {
    // Both pages pre-cached: this is the reviewer's scenario — with data
    // already in the cache, usePage never flips isPending on navigation,
    // so PageView never returns null and nothing unmounts. Without
    // key={page.id}, React Router reuses the same NotesPageView/
    // RichTextEditor instances across the pageId change, and useEditor's
    // initial-value-only contract would keep showing page A's document
    // under page B's title.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(['page', 'page-a'], pageA)
    queryClient.setQueryData(['page', 'page-b'], pageB)

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/notes/page-a']}>
          <GoToPageB />
          <Routes>
            <Route path="/:section/:pageId" element={<PageView />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Alpha page' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Alpha doc text')).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Go to page B' }))
    })

    expect(
      await screen.findByRole('heading', { name: 'Beta page' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Beta doc text')).toBeInTheDocument()
    expect(screen.queryByText('Alpha doc text')).not.toBeInTheDocument()
  })

  it('shows "Page not found" for an unknown section without ever querying Supabase', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/garbage/xyz']}>
          <Routes>
            <Route path="/:section/:pageId" element={<PageView />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Page not found.')).toBeInTheDocument()
    // Give a (wrongly) enabled query a chance to fire before asserting.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('shows a centered loading indicator instead of a blank screen on first load', async () => {
    // A controllable (never-resolving-yet) builder, mirroring the
    // "Saving…" test's pattern, so the isPending window is actually
    // observable instead of racing a mock that resolves within a tick.
    const single = vi.fn(() => new Promise(() => {}))
    mockFrom.mockImplementation(() => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        single,
      }
      return builder
    })

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/notes/page-a']}>
          <Routes>
            <Route path="/:section/:pageId" element={<PageView />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Loading…')).toBeInTheDocument()
  })
})
