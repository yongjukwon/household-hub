import { act, renderHook, waitFor } from '@testing-library/react'
import {
  QueryClient,
  QueryClientProvider,
  type UseQueryResult,
} from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  usePages,
  usePage,
  useCreatePage,
  useDeletePage,
  useRenamePage,
  useUpdatePageContent,
} from '@/hooks/usePages'
import { mockFrom, mockFromResult, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

vi.mock('@/hooks/useHousehold', () => ({
  useHousehold: vi.fn(),
}))

import { useHousehold, type HouseholdData } from '@/hooks/useHousehold'
const mockUseHousehold = vi.mocked(useHousehold)

const fakeHousehold: HouseholdData = {
  id: 'household-1',
  name: 'Our Household',
  members: [],
}

// Only `.data` matters to useCreatePage; the rest of UseQueryResult is
// irrelevant to these tests, hence the cast.
function householdQueryResult(
  data: HouseholdData,
): UseQueryResult<HouseholdData> {
  return { data } as UseQueryResult<HouseholdData>
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const fakePage = {
  id: 'page-1',
  household_id: 'household-1',
  section: 'budget' as const,
  template: 'budget' as const,
  title: 'Groceries budget',
  content: { type: 'doc', content: [] },
  created_by: 'user-1',
  archived: false,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

describe('usePages', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('returns non-archived pages for the section ordered by updated_at desc', async () => {
    const builder = mockFromResult([fakePage])

    const { result } = renderHook(() => usePages('budget'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([fakePage])
    expect(mockFrom).toHaveBeenCalledWith('pages')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('section', 'budget')
    expect(builder.eq).toHaveBeenCalledWith('archived', false)
    expect(builder.order).toHaveBeenCalledWith('updated_at', {
      ascending: false,
    })
  })

  it('throws when the query errors', async () => {
    mockFromResult(null, new Error('boom'))

    const { result } = renderHook(() => usePages('budget'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('usePage', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('fetches a single page by id', async () => {
    const builder = mockFromResult(fakePage)

    const { result } = renderHook(() => usePage('page-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(fakePage)
    expect(mockFrom).toHaveBeenCalledWith('pages')
    expect(builder.eq).toHaveBeenCalledWith('id', 'page-1')
    expect(builder.single).toHaveBeenCalled()
  })

  it('does not query Supabase when enabled: false is passed, even with a pageId', async () => {
    mockFromResult(fakePage)

    const { result } = renderHook(() => usePage('page-1', { enabled: false }), {
      wrapper,
    })

    // Give any (wrongly) in-flight query a chance to resolve.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('useCreatePage', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    mockUseHousehold.mockReturnValue(householdQueryResult(fakeHousehold))
  })

  it('inserts a page with household_id, section, template, title and invalidates the section list', async () => {
    const builder = mockFromResult(fakePage)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    function localWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    }

    const { result } = renderHook(() => useCreatePage(), {
      wrapper: localWrapper,
    })

    result.current.mutate({
      section: 'budget',
      template: 'budget',
      title: 'Groceries budget',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('pages')
    expect(builder.insert).toHaveBeenCalledWith({
      household_id: 'household-1',
      section: 'budget',
      template: 'budget',
      title: 'Groceries budget',
    })
    expect(builder.select).toHaveBeenCalled()
    expect(builder.single).toHaveBeenCalled()
    expect(result.current.data).toEqual(fakePage)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['pages', 'budget'],
    })
  })
})

describe('useDeletePage', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('hard deletes a page by id and invalidates pages queries', async () => {
    const builder = mockFromResult(null)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    function localWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    }

    const { result } = renderHook(() => useDeletePage(), {
      wrapper: localWrapper,
    })

    result.current.mutate('page-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('pages')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'page-1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['pages'] })
  })
})

describe('useRenamePage', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('updates the title, caches the returned row, and invalidates the section list by the row section', async () => {
    const renamedPage = { ...fakePage, title: 'New title' }
    const builder = mockFromResult(renamedPage)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

    function localWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    }

    const { result } = renderHook(() => useRenamePage(), {
      wrapper: localWrapper,
    })

    result.current.mutate({ pageId: 'page-1', title: 'New title' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('pages')
    expect(builder.update).toHaveBeenCalledWith({ title: 'New title' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'page-1')
    expect(setQueryDataSpy).toHaveBeenCalledWith(['page', 'page-1'], renamedPage)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['pages', 'budget'],
    })
  })
})

describe('useUpdatePageContent', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  const newContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
  }
  const updatedPage = { ...fakePage, content: newContent }

  it('updates content, caches the returned row, and invalidates the section list using the row section — without invalidating the page key', async () => {
    const builder = mockFromResult(updatedPage)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

    function localWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    }

    const { result } = renderHook(() => useUpdatePageContent(), {
      wrapper: localWrapper,
    })

    result.current.mutate({ pageId: 'page-1', content: newContent })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('pages')
    expect(builder.update).toHaveBeenCalledWith({ content: newContent })
    expect(builder.eq).toHaveBeenCalledWith('id', 'page-1')
    expect(builder.select).toHaveBeenCalled()
    expect(builder.single).toHaveBeenCalled()

    expect(setQueryDataSpy).toHaveBeenCalledWith(
      ['page', 'page-1'],
      updatedPage,
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['pages', 'budget'],
    })
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ['page', 'page-1'],
    })
  })

  it('serializes concurrent saves for the same page and never lets a stale response overwrite a newer one, even if it resolves later', async () => {
    // Two debounced autosaves fire in quick succession for the SAME page.
    // The mock's `single()` is controllable (per the pattern in
    // NotesPageView.test.tsx's "Saving…" test) so the test can resolve the
    // OLDER save's request *after* dispatching the newer one — the exact
    // out-of-order-completion scenario the fix guards against — and still
    // assert the server only ever sees one in-flight request at a time, in
    // the order they were issued, with the newer content winning the cache.
    const pageId = 'page-race'
    const olderContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'older' }] },
      ],
    }
    const newerContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'newer' }] },
      ],
    }
    const olderRow = { ...fakePage, id: pageId, content: olderContent }
    const newerRow = { ...fakePage, id: pageId, content: newerContent }

    const resolvers: Array<(value: { data: unknown; error: unknown }) => void> =
      []
    const updateCalls: unknown[] = []
    const single = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        }),
    )
    const builder = {
      update: vi.fn((payload: unknown) => {
        updateCalls.push(payload)
        return builder
      }),
      eq: vi.fn(() => builder),
      select: vi.fn(() => builder),
      single,
    }
    mockFrom.mockReturnValue(builder)

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    function localWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    }

    const { result } = renderHook(() => useUpdatePageContent(), {
      wrapper: localWrapper,
    })

    act(() => {
      result.current.mutate({ pageId, content: olderContent })
    })
    await waitFor(() => expect(single).toHaveBeenCalledTimes(1))

    await act(async () => {
      result.current.mutate({ pageId, content: newerContent })
      // Flush pending microtasks/timers so a not-actually-serialized
      // implementation would have already dispatched the second request
      // by now — this is what makes the assertion below a real check of
      // serialization rather than a timing coincidence.
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    // The second save must be queued behind the first, not fired
    // concurrently — otherwise the server could receive them out of order.
    expect(single).toHaveBeenCalledTimes(1)

    // Resolve the OLDER request first (as the fix requires) — only once
    // it settles does the newer request actually go out.
    await act(async () => {
      resolvers[0]({ data: olderRow, error: null })
      await waitFor(() => expect(single).toHaveBeenCalledTimes(2))
    })

    // Resolve the newer request too.
    await act(async () => {
      resolvers[1]({ data: newerRow, error: null })
    })

    await waitFor(() =>
      expect(queryClient.getQueryData(['page', pageId])).toEqual(newerRow),
    )

    // The server received them in issue order, never concurrently.
    expect(updateCalls).toEqual([
      { content: olderContent },
      { content: newerContent },
    ])
  })
})
