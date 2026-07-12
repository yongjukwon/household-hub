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
  useGroceryPriceHistory,
  useUpdateGroceryItem,
} from '@/hooks/useGroceries'
import { mockFrom, mockFromResult, resetSupabaseMocks } from './mocks/supabase'

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

  it('loads items in stable sort order and normalizes prices', async () => {
    const builder = mockFromResult([milk])
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useGroceryItems('page-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('grocery_items')
    expect(builder.eq).toHaveBeenCalledWith('page_id', 'page-1')
    expect(builder.order.mock.calls).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: true }],
      ['id', { ascending: true }],
    ])
    expect(result.current.data?.[0].last_price).toBe(5.49)
  })

  it('loads newest-first price history for a name, capped by limit', async () => {
    const builder = mockFromResult([milkPrice])
    const { wrapper } = createHarness()
    const { result } = renderHook(
      () => useGroceryPriceHistory('page-1', 'milk', { limit: 5 }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('grocery_price_history')
    expect(builder.eq.mock.calls).toEqual([
      ['page_id', 'page-1'],
      ['item_name_normalized', 'milk'],
    ])
    expect(builder.order.mock.calls).toEqual([
      ['recorded_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
    expect(builder.limit).toHaveBeenCalledWith(5)
    expect(result.current.data?.[0].price).toBe(5.49)
  })

  it('does not query history for an empty name', async () => {
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useGroceryPriceHistory('page-1', ''), {
      wrapper,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
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
      queryKey: groceryKeys.history('page-1'),
    })
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
