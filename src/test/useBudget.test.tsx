import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  budgetKeys,
  currentMonthKey,
  monthBounds,
  moneyToCents,
  shiftMonthKey,
  useBudgetCategories,
  useBudgetEntries,
  useCreateBudgetCategory,
  useCreateBudgetEntry,
  useDeleteBudgetCategory,
  useDeleteBudgetEntry,
  useUpdateBudgetCategory,
  useUpdateBudgetEntry,
} from '@/hooks/useBudget'
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

const categoryFromDatabase = {
  id: 'category-1',
  household_id: 'household-1',
  page_id: 'page-1',
  name: 'Food',
  monthly_limit: '750.25',
  sort_order: 0,
  created_at: '2026-07-01T00:00:00.000Z',
}

const entryFromDatabase = {
  id: 'entry-1',
  household_id: 'household-1',
  page_id: 'page-1',
  category_id: 'category-1',
  amount: '12.34',
  description: 'Lunch',
  entry_date: '2026-07-11',
  created_by: 'user-1',
  created_at: '2026-07-11T18:00:00.000Z',
}

describe('budget month and money helpers', () => {
  it('uses local calendar fields for the current month', () => {
    expect(currentMonthKey(new Date(2026, 0, 15))).toBe('2026-01')
    expect(currentMonthKey(new Date(2026, 11, 31))).toBe('2026-12')
  })

  it('shifts across year boundaries and returns half-open date bounds', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01')
    expect(monthBounds('2026-02')).toEqual({
      start: '2026-02-01',
      end: '2026-03-01',
    })
  })

  it('rejects invalid month and currency values', () => {
    expect(() => monthBounds('2026-13')).toThrow('Invalid month key')
    expect(() => shiftMonthKey('July 2026', 1)).toThrow('Invalid month key')
    expect(() => moneyToCents('not money')).toThrow('Invalid currency value')
  })
})

describe('budget queries', () => {
  beforeEach(resetSupabaseMocks)

  it('loads categories in stable display order and normalizes numeric values', async () => {
    const builder = mockFromResult([categoryFromDatabase])
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useBudgetCategories('page-1'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('budget_categories')
    expect(builder.eq).toHaveBeenCalledWith('page_id', 'page-1')
    expect(builder.order.mock.calls).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: true }],
      ['id', { ascending: true }],
    ])
    expect(result.current.data?.[0].monthly_limit).toBe(750.25)
  })

  it('loads only the selected half-open month in newest-first order and normalizes amounts', async () => {
    const builder = mockFromResult([entryFromDatabase])
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useBudgetEntries('page-1', '2026-07'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('budget_entries')
    expect(builder.eq).toHaveBeenCalledWith('page_id', 'page-1')
    expect(builder.gte).toHaveBeenCalledWith('entry_date', '2026-07-01')
    expect(builder.lt).toHaveBeenCalledWith('entry_date', '2026-08-01')
    expect(builder.order.mock.calls).toEqual([
      ['entry_date', { ascending: false }],
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
    expect(result.current.data?.[0].amount).toBe(12.34)
  })

  it('does not query with an invalid month and propagates query errors', async () => {
    const { wrapper } = createHarness()
    const invalid = renderHook(() => useBudgetEntries('page-1', '2026-99'), {
      wrapper,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(invalid.result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()

    mockFromResult(null, new Error('budget unavailable'))
    const failed = renderHook(() => useBudgetCategories('page-2'), { wrapper })
    await waitFor(() => expect(failed.result.current.isError).toBe(true))
    expect(failed.result.current.error).toEqual(new Error('budget unavailable'))
  })
})

describe('budget category mutations', () => {
  beforeEach(resetSupabaseMocks)

  it('creates an idempotent category payload and invalidates categories', async () => {
    const builder = mockFromResult(categoryFromDatabase)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useCreateBudgetCategory(), { wrapper })
    result.current.mutate({
      id: 'category-1',
      pageId: 'page-1',
      name: 'Food',
      monthlyLimit: 750.25,
      sortOrder: 0,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        id: 'category-1',
        page_id: 'page-1',
        name: 'Food',
        monthly_limit: 750.25,
        sort_order: 0,
      },
      { onConflict: 'id' },
    )
    expect(result.current.data?.monthly_limit).toBe(750.25)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: budgetKeys.categories('page-1'),
    })
  })

  it('updates by both id and page id and propagates mutation errors', async () => {
    const failure = new Error('update denied')
    const builder = mockFromResult(null, failure)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useUpdateBudgetCategory(), { wrapper })
    result.current.mutate({
      id: 'category-1',
      pageId: 'page-1',
      name: 'Dining',
      monthlyLimit: 500,
      sortOrder: 2,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(builder.update).toHaveBeenCalledWith({
      name: 'Dining',
      monthly_limit: 500,
      sort_order: 2,
    })
    expect(builder.eq.mock.calls).toEqual([
      ['id', 'category-1'],
      ['page_id', 'page-1'],
    ])
    expect(result.current.error).toBe(failure)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('deletes by id and page id and invalidates categories plus all page entries', async () => {
    const builder = mockFromResult(null)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useDeleteBudgetCategory(), { wrapper })
    result.current.mutate({ id: 'category-1', pageId: 'page-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq.mock.calls).toEqual([
      ['id', 'category-1'],
      ['page_id', 'page-1'],
    ])
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: budgetKeys.categories('page-1'),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: budgetKeys.entries('page-1'),
    })
  })
})

describe('budget entry mutations', () => {
  beforeEach(resetSupabaseMocks)

  const input = {
    id: 'entry-1',
    pageId: 'page-1',
    categoryId: 'category-1',
    amount: 12.34,
    description: 'Lunch',
    entryDate: '2026-07-11',
  }

  it('creates an idempotent entry payload and invalidates every month for the page', async () => {
    const builder = mockFromResult(entryFromDatabase)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useCreateBudgetEntry(), { wrapper })
    result.current.mutate(input)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        id: 'entry-1',
        page_id: 'page-1',
        category_id: 'category-1',
        amount: 12.34,
        description: 'Lunch',
        entry_date: '2026-07-11',
      },
      { onConflict: 'id' },
    )
    expect(result.current.data?.amount).toBe(12.34)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: budgetKeys.entries('page-1'),
    })
  })

  it('updates an entry by id and page id with the editable payload', async () => {
    const builder = mockFromResult(entryFromDatabase)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useUpdateBudgetEntry(), { wrapper })
    result.current.mutate(input)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.update).toHaveBeenCalledWith({
      category_id: 'category-1',
      amount: 12.34,
      description: 'Lunch',
      entry_date: '2026-07-11',
    })
    expect(builder.eq.mock.calls).toEqual([
      ['id', 'entry-1'],
      ['page_id', 'page-1'],
    ])
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: budgetKeys.entries('page-1'),
    })
  })

  it('deletes an entry and surfaces database errors without invalidating', async () => {
    const failure = new Error('delete denied')
    const builder = mockFromResult(null, failure)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useDeleteBudgetEntry(), { wrapper })
    result.current.mutate({ id: 'entry-1', pageId: 'page-1' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq.mock.calls).toEqual([
      ['id', 'entry-1'],
      ['page_id', 'page-1'],
    ])
    expect(result.current.error).toBe(failure)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
