import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  groceryKeys,
  normalizeItemName,
  useClearCheckedGroceryItems,
  useCreateGroceryItem,
  useDeleteGroceryItem,
  useGroceryItems,
  useGroceryNameSuggestions,
  useGroceryPriceHistory,
  useUpdateGroceryItem,
} from '@/hooks/useGroceries'
import { mockFrom, mockFromResult, resetSupabaseMocks } from './mocks/supabase'

// A minimal thenable query builder resolving to { data, error: null } — for
// the suggestions query, which fires two selects in parallel (Promise.all).
function makeThenable(data: unknown) {
  const builder = {
    select: () => builder,
    then: (
      onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data, error: null }).then(onFulfilled, onRejected),
  }
  return builder
}

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

vi.mock('@/lib/offline/outbox', () => ({
  queueWrite: vi.fn(),
}))

const mockQueueWrite = vi.mocked(
  (await import('@/lib/offline/outbox')).queueWrite,
)

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  return { wrapper, queryClient, invalidateSpy }
}

const milk = {
  id: 'item-milk',
  household_id: 'household-1',
  page_id: 'page-1',
  name: 'Milk',
  name_normalized: 'milk',
  checked: false,
  last_price: '5.49',
  sort_order: 0,
  created_at: '2026-07-11T18:00:00.000Z',
  updated_at: '2026-07-11T18:00:00.000Z',
}

const milkPrice = {
  id: 'history-1',
  household_id: 'household-1',
  page_id: 'page-1',
  item_name_normalized: 'milk',
  price: '5.49',
  recorded_by: 'user-1',
  recorded_at: '2026-07-11T18:00:00.000Z',
}

describe('grocery helpers', () => {
  it('normalizes item names by trimming and lowercasing', () => {
    expect(normalizeItemName('  Whole Milk ')).toBe('whole milk')
    expect(normalizeItemName('')).toBe('')
  })
})

describe('grocery queries', () => {
  beforeEach(resetSupabaseMocks)

  it('loads items newest-first and normalizes prices', async () => {
    const builder = mockFromResult([milk])
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useGroceryItems('page-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('grocery_items')
    expect(builder.eq).toHaveBeenCalledWith('page_id', 'page-1')
    expect(builder.order.mock.calls).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
    expect(result.current.data?.[0].last_price).toBe(5.49)
  })

  it('loads newest-first household-wide price history for a name, with store labels', async () => {
    const builder = mockFromResult([
      { ...milkPrice, pages: { title: 'Costco' } },
    ])
    const { wrapper } = createHarness()
    const { result } = renderHook(
      () => useGroceryPriceHistory('milk', { limit: 5 }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('grocery_price_history')
    expect(builder.select).toHaveBeenCalledWith('*, pages(title)')
    // Household-wide: filters by name only (RLS scopes to the household), not
    // by page_id.
    expect(builder.eq.mock.calls).toEqual([['item_name_normalized', 'milk']])
    expect(builder.order.mock.calls).toEqual([
      ['recorded_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
    expect(builder.limit).toHaveBeenCalledWith(5)
    expect(result.current.data?.[0].price).toBe(5.49)
    expect(result.current.data?.[0].store).toBe('Costco')
  })

  it('does not query history for an empty name', async () => {
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useGroceryPriceHistory(''), {
      wrapper,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('builds household-wide name suggestions from items and history, deduped by normalized name', async () => {
    // Two .from() calls run in parallel: grocery_items then price history.
    mockFrom
      .mockReturnValueOnce(
        makeThenable([
          { name: 'Whole Milk', name_normalized: 'whole milk' },
          { name: 'Eggs', name_normalized: 'eggs' },
        ]),
      )
      .mockReturnValueOnce(
        makeThenable([
          // Duplicate of a current item (different casing) — deduped, current
          // item's casing wins.
          { item_name: 'whole milk', item_name_normalized: 'whole milk' },
          // History-only name (a cleared item) still surfaces.
          { item_name: 'Bread', item_name_normalized: 'bread' },
        ]),
      )
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useGroceryNameSuggestions(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(['Bread', 'Eggs', 'Whole Milk'])
  })
})

describe('grocery mutations (offline-capable outbox writes)', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    mockQueueWrite.mockReset().mockResolvedValue('synced')
  })

  it('creates via a queued idempotent upsert, patching the cache optimistically', async () => {
    const { wrapper, queryClient, invalidateSpy } = createHarness()
    queryClient.setQueryData(groceryKeys.items('page-1'), [])
    const { result } = renderHook(() => useCreateGroceryItem(), { wrapper })
    result.current.mutate({
      id: 'item-milk',
      pageId: 'page-1',
      name: '  Milk ',
      sortOrder: 0,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockQueueWrite).toHaveBeenCalledWith({
      clientId: 'item-milk',
      table: 'grocery_items',
      op: 'upsert',
      payload: {
        id: 'item-milk',
        page_id: 'page-1',
        name: '  Milk ',
        sort_order: 0,
      },
      match: { id: 'item-milk' },
    })
    const cached = queryClient.getQueryData<
      Array<{ id: string; name_normalized: string }>
    >(groceryKeys.items('page-1'))
    expect(cached?.[0].id).toBe('item-milk')
    expect(cached?.[0].name_normalized).toBe('milk')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groceryKeys.items('page-1'),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groceryKeys.history(),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groceryKeys.names(),
    })
  })

  it('includes last_price in the create when a price is given and prepends the row', async () => {
    const { wrapper, queryClient } = createHarness()
    queryClient.setQueryData(groceryKeys.items('page-1'), [
      { id: 'existing', name_normalized: 'bread' },
    ])
    const { result } = renderHook(() => useCreateGroceryItem(), { wrapper })
    result.current.mutate({
      id: 'item-milk',
      pageId: 'page-1',
      name: 'Milk',
      sortOrder: 0,
      lastPrice: 5.49,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockQueueWrite).toHaveBeenCalledWith({
      clientId: 'item-milk',
      table: 'grocery_items',
      op: 'upsert',
      payload: {
        id: 'item-milk',
        page_id: 'page-1',
        name: 'Milk',
        sort_order: 0,
        last_price: 5.49,
      },
      match: { id: 'item-milk' },
    })
    // Prepended (newest-first) and carries the price optimistically.
    const cached = queryClient.getQueryData<
      Array<{ id: string; last_price: number | null }>
    >(groceryKeys.items('page-1'))
    expect(cached?.[0].id).toBe('item-milk')
    expect(cached?.[0].last_price).toBe(5.49)
    expect(cached?.[1].id).toBe('existing')
  })

  it('resolves as queued while offline without invalidating (cache keeps the optimistic row)', async () => {
    mockQueueWrite.mockResolvedValue('queued')
    const { wrapper, queryClient, invalidateSpy } = createHarness()
    queryClient.setQueryData(groceryKeys.items('page-1'), [])
    const { result } = renderHook(() => useCreateGroceryItem(), { wrapper })
    result.current.mutate({
      id: 'item-milk',
      pageId: 'page-1',
      name: 'Milk',
      sortOrder: 0,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('queued')
    expect(invalidateSpy).not.toHaveBeenCalled()
    const cached = queryClient.getQueryData<Array<{ id: string }>>(
      groceryKeys.items('page-1'),
    )
    expect(cached).toHaveLength(1)
  })

  it('queues only provided fields on partial updates, patching the cached row', async () => {
    const { wrapper, queryClient } = createHarness()
    queryClient.setQueryData(groceryKeys.items('page-1'), [milk])
    const { result } = renderHook(() => useUpdateGroceryItem(), { wrapper })
    result.current.mutate({ id: 'item-milk', pageId: 'page-1', checked: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockQueueWrite).toHaveBeenCalledWith({
      clientId: 'item-milk',
      table: 'grocery_items',
      op: 'update',
      payload: { checked: true },
      match: { id: 'item-milk', page_id: 'page-1' },
    })
    const cached = queryClient.getQueryData<Array<{ checked: boolean }>>(
      groceryKeys.items('page-1'),
    )
    expect(cached?.[0].checked).toBe(true)
  })

  it('queues a row-scoped delete and removes the row from the cache', async () => {
    const { wrapper, queryClient } = createHarness()
    queryClient.setQueryData(groceryKeys.items('page-1'), [milk])
    const { result } = renderHook(() => useDeleteGroceryItem(), { wrapper })
    result.current.mutate({ id: 'item-milk', pageId: 'page-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockQueueWrite).toHaveBeenCalledWith({
      clientId: 'item-milk',
      table: 'grocery_items',
      op: 'delete',
      payload: {},
      match: { id: 'item-milk', page_id: 'page-1' },
    })
    expect(
      queryClient.getQueryData<unknown[]>(groceryKeys.items('page-1')),
    ).toHaveLength(0)
  })

  it('clears checked items as row-scoped deletes (replays can never remove later check-offs)', async () => {
    const checkedMilk = { ...milk, checked: true }
    const other = { ...milk, id: 'item-bread', checked: true }
    const { wrapper, queryClient, invalidateSpy } = createHarness()
    queryClient.setQueryData(groceryKeys.items('page-1'), [checkedMilk, other])
    const { result } = renderHook(() => useClearCheckedGroceryItems(), {
      wrapper,
    })
    result.current.mutate({
      pageId: 'page-1',
      ids: ['item-milk', 'item-bread'],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockQueueWrite).toHaveBeenCalledTimes(2)
    expect(mockQueueWrite).toHaveBeenNthCalledWith(1, {
      clientId: 'item-milk',
      table: 'grocery_items',
      op: 'delete',
      payload: {},
      match: { id: 'item-milk', page_id: 'page-1' },
    })
    expect(
      queryClient.getQueryData<unknown[]>(groceryKeys.items('page-1')),
    ).toHaveLength(0)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groceryKeys.items('page-1'),
    })
  })
})
