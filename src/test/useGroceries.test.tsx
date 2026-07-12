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
  return { wrapper, invalidateSpy }
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

describe('grocery mutations', () => {
  beforeEach(resetSupabaseMocks)

  it('creates an idempotent item payload and invalidates items plus history', async () => {
    const builder = mockFromResult(milk)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useCreateGroceryItem(), { wrapper })
    result.current.mutate({
      id: 'item-milk',
      pageId: 'page-1',
      name: 'Milk',
      sortOrder: 0,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        id: 'item-milk',
        page_id: 'page-1',
        name: 'Milk',
        sort_order: 0,
      },
      { onConflict: 'id' },
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groceryKeys.items('page-1'),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groceryKeys.history('page-1'),
    })
  })

  it('sends only provided fields on partial updates, scoped to id and page', async () => {
    const builder = mockFromResult({ ...milk, checked: true })
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useUpdateGroceryItem(), { wrapper })
    result.current.mutate({ id: 'item-milk', pageId: 'page-1', checked: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.update).toHaveBeenCalledWith({ checked: true })
    expect(builder.eq.mock.calls).toEqual([
      ['id', 'item-milk'],
      ['page_id', 'page-1'],
    ])
  })

  it('updates price through the same partial contract (history is appended server-side)', async () => {
    const builder = mockFromResult(milk)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useUpdateGroceryItem(), { wrapper })
    result.current.mutate({ id: 'item-milk', pageId: 'page-1', lastPrice: 5.49 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.update).toHaveBeenCalledWith({ last_price: 5.49 })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groceryKeys.history('page-1'),
    })
  })

  it('deletes an item and surfaces database errors without invalidating', async () => {
    const failure = new Error('delete denied')
    const builder = mockFromResult(null, failure)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useDeleteGroceryItem(), { wrapper })
    result.current.mutate({ id: 'item-milk', pageId: 'page-1' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(builder.delete).toHaveBeenCalled()
    expect(result.current.error).toBe(failure)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('clears only checked items for the page and invalidates items', async () => {
    const builder = mockFromResult(null)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useClearCheckedGroceryItems(), {
      wrapper,
    })
    result.current.mutate('page-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq.mock.calls).toEqual([
      ['page_id', 'page-1'],
      ['checked', true],
    ])
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groceryKeys.items('page-1'),
    })
  })
})
