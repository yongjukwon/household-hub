import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JSONContent } from '@tiptap/react'
import { NotesPageView } from '@/components/notes/NotesPageView'
import { mockFrom, mockFromResult, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

// RichTextEditor's own formatting/debounce behavior is already covered by
// RichTextEditor.test.tsx (Task 2) — here it's stubbed to a single button
// that fires onChange synchronously, so these tests can focus on
// NotesPageView's own wiring (content passed in, onChange -> mutation,
// save-state indicator) without re-testing Tiptap internals.
let latestOnChange: ((json: JSONContent) => void) | undefined
vi.mock('@/components/notes/RichTextEditor', () => ({
  RichTextEditor: ({
    content,
    onChange,
  }: {
    content: JSONContent
    onChange: (json: JSONContent) => void
  }) => {
    latestOnChange = onChange
    return (
      <div data-testid="editor-stub" data-content={JSON.stringify(content)} />
    )
  },
}))

const fakePage = {
  id: 'page-1',
  household_id: 'household-1',
  section: 'notes' as const,
  template: 'blank' as const,
  title: 'Grocery ideas',
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  created_by: 'user-1',
  archived: false,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <NotesPageView page={fakePage} />
    </QueryClientProvider>,
  )
}

describe('NotesPageView', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    latestOnChange = undefined
  })

  it('renders the page title and the editor with the page content, no save indicator when idle', () => {
    mockFromResult({ ...fakePage })

    renderView()

    expect(
      screen.getByRole('heading', { name: 'Grocery ideas' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('editor-stub')).toHaveAttribute(
      'data-content',
      JSON.stringify(fakePage.content),
    )
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('saves via useUpdatePageContent when the editor reports a change, showing "Saving…" while pending', async () => {
    // A controllable (not auto-resolving) builder, so the pending window
    // between mutate() and the update resolving is actually observable
    // instead of racing a mock that resolves within a single microtask.
    const updatedPage = { ...fakePage, content: { type: 'doc', content: [] } }
    let resolveSingle!: (value: { data: unknown; error: unknown }) => void
    const single = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSingle = resolve
        }),
    )
    const builder = {
      update: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      select: vi.fn(() => builder),
      single,
    }
    mockFrom.mockReturnValue(builder)

    renderView()

    expect(latestOnChange).toBeDefined()
    act(() => {
      latestOnChange!({ type: 'doc', content: [] })
    })

    // The mock's `single()` deliberately never resolves until
    // resolveSingle() is called below, so this "Saving…" state is stable
    // (not a race against the mutation completing) — waitFor here is just
    // absorbing whichever tick React Query's mutate() flips isPending on.
    await waitFor(() =>
      expect(screen.getByText('Saving…')).toBeInTheDocument(),
    )

    await act(async () => {
      resolveSingle({ data: updatedPage, error: null })
    })

    await waitFor(() =>
      expect(screen.queryByText('Saving…')).not.toBeInTheDocument(),
    )

    expect(mockFrom).toHaveBeenCalledWith('pages')
  })

  it('shows an inline danger message on save failure and keeps the editor mounted', async () => {
    mockFromResult(null, new Error('network down'))

    renderView()

    act(() => {
      latestOnChange!({ type: 'doc', content: [] })
    })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn.t save/i)
    expect(screen.getByTestId('editor-stub')).toBeInTheDocument()
  })
})
