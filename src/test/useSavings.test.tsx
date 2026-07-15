import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  savingsKeys,
  semiMonthlyOccurrences,
  todayKey,
  useCreateSavingsSource,
  useCreateSavingsTransaction,
  useDeleteSavingsTransaction,
  useSaveSavingsDepositRule,
  useSavingsSources,
  useSavingsTransactions,
} from '@/hooks/useSavings'
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

const rule = (
  overrides: Partial<{
    day_of_month_1: number
    day_of_month_2: number
    start_date: string
    last_generated_date: string | null
  }> = {},
) => ({
  day_of_month_1: 1,
  day_of_month_2: 15,
  start_date: '2026-01-01',
  last_generated_date: null,
  ...overrides,
})

describe('semiMonthlyOccurrences', () => {
  it('generates both days per month between the floor and today', () => {
    expect(
      semiMonthlyOccurrences(
        rule({ start_date: '2026-05-01', last_generated_date: '2026-05-15' }),
        '2026-07-14',
      ),
    ).toEqual(['2026-06-01', '2026-06-15', '2026-07-01'])
  })

  it('starts from start_date inclusive when never generated', () => {
    expect(
      semiMonthlyOccurrences(rule({ start_date: '2026-07-01' }), '2026-07-14'),
    ).toEqual(['2026-07-01'])
  })

  it('skips occurrences before start_date even in the starting month', () => {
    expect(
      semiMonthlyOccurrences(rule({ start_date: '2026-07-10' }), '2026-07-20'),
    ).toEqual(['2026-07-15'])
  })

  it('clamps day 31 to each month’s actual length', () => {
    expect(
      semiMonthlyOccurrences(
        rule({
          day_of_month_1: 15,
          day_of_month_2: 31,
          start_date: '2026-04-01',
          last_generated_date: '2026-03-31',
        }),
        '2026-05-31',
      ),
    ).toEqual(['2026-04-15', '2026-04-30', '2026-05-15', '2026-05-31'])
  })

  it('clamps day 30/31 to Feb 28 (non-leap) and collapses colliding days', () => {
    expect(
      semiMonthlyOccurrences(
        rule({
          day_of_month_1: 30,
          day_of_month_2: 31,
          start_date: '2026-02-01',
        }),
        '2026-03-05',
      ),
      // Both configured days clamp to Feb 28 — a single occurrence, not two.
    ).toEqual(['2026-02-28'])
  })

  it('clamps to Feb 29 in a leap year', () => {
    expect(
      semiMonthlyOccurrences(
        rule({
          day_of_month_1: 15,
          day_of_month_2: 31,
          start_date: '2028-02-01',
        }),
        '2028-03-01',
      ),
    ).toEqual(['2028-02-15', '2028-02-29'])
  })

  it('catches up many missed months at once, in order', () => {
    const occurrences = semiMonthlyOccurrences(
      rule({ start_date: '2026-01-01', last_generated_date: '2026-01-15' }),
      '2026-07-14',
    )
    expect(occurrences).toHaveLength(11) // Feb–Jun ×2 + Jul 1
    expect(occurrences[0]).toBe('2026-02-01')
    expect(occurrences.at(-1)).toBe('2026-07-01')
    expect([...occurrences].sort()).toEqual(occurrences)
  })

  it('returns [] when already up to date or today precedes the start', () => {
    expect(
      semiMonthlyOccurrences(
        rule({ last_generated_date: '2026-07-01' }),
        '2026-07-14',
      ),
    ).toEqual([])
    expect(
      semiMonthlyOccurrences(rule({ start_date: '2026-08-01' }), '2026-07-14'),
    ).toEqual([])
  })

  it('does not regenerate anything when called again after catching up (idempotent)', () => {
    const first = semiMonthlyOccurrences(
      rule({ last_generated_date: '2026-05-15' }),
      '2026-07-14',
    )
    const after = semiMonthlyOccurrences(
      rule({ last_generated_date: first.at(-1)! }),
      '2026-07-14',
    )
    expect(after).toEqual([])
  })
})

describe('todayKey', () => {
  it('formats local calendar fields', () => {
    expect(todayKey(new Date(2026, 6, 14))).toBe('2026-07-14')
    expect(todayKey(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

const sourceRow = {
  id: 'source-1',
  household_id: 'household-1',
  name: 'TFSA',
  amount: '1200.50',
  sort_order: 0,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
}

const transactionRow = {
  id: 'txn-1',
  household_id: 'household-1',
  source_id: 'source-1',
  type: 'withdrawal' as const,
  amount: '500.00',
  reason: 'Car repair',
  occurred_at: '2026-07-10',
  created_by: 'user-1',
  auto_deposit_rule_id: null,
  created_at: '2026-07-10T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

describe('savings queries', () => {
  beforeEach(resetSupabaseMocks)

  it('loads sources oldest-first and normalizes amounts', async () => {
    const builder = mockFromResult([sourceRow])
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useSavingsSources(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('savings_sources')
    expect(builder.order).toHaveBeenCalledWith('created_at', {
      ascending: true,
    })
    expect(result.current.data?.[0].amount).toBe(1200.5)
  })

  it('loads a source’s ledger newest-first', async () => {
    const builder = mockFromResult([transactionRow])
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useSavingsTransactions('source-1'), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.eq).toHaveBeenCalledWith('source_id', 'source-1')
    expect(builder.order.mock.calls).toEqual([
      ['occurred_at', { ascending: false }],
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
    expect(result.current.data?.[0].amount).toBe(500)
  })
})

describe('savings mutations', () => {
  beforeEach(resetSupabaseMocks)

  it('creates a source with the starting amount (no transaction) and invalidates sources', async () => {
    const builder = mockFromResult(sourceRow)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useCreateSavingsSource(), { wrapper })
    result.current.mutate({
      id: 'source-1',
      householdId: 'household-1',
      name: 'TFSA',
      startingAmount: 1200.5,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        id: 'source-1',
        household_id: 'household-1',
        name: 'TFSA',
        amount: 1200.5,
      },
      { onConflict: 'id' },
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: savingsKeys.sources(),
    })
  })

  it('creates a transaction (no client-side balance math) and invalidates ledger + sources', async () => {
    const builder = mockFromResult(transactionRow)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useCreateSavingsTransaction(), {
      wrapper,
    })
    result.current.mutate({
      id: 'txn-1',
      sourceId: 'source-1',
      type: 'withdrawal',
      amount: 500,
      reason: 'Car repair',
      occurredAt: '2026-07-10',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        id: 'txn-1',
        source_id: 'source-1',
        type: 'withdrawal',
        amount: 500,
        reason: 'Car repair',
        occurred_at: '2026-07-10',
      },
      { onConflict: 'id' },
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: savingsKeys.transactions('source-1'),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: savingsKeys.sources(),
    })
  })

  it('deletes a transaction scoped to id + source and refreshes the balance', async () => {
    const builder = mockFromResult(null)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useDeleteSavingsTransaction(), {
      wrapper,
    })
    result.current.mutate({ id: 'txn-1', sourceId: 'source-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq.mock.calls).toEqual([
      ['id', 'txn-1'],
      ['source_id', 'source-1'],
    ])
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: savingsKeys.sources(),
    })
  })

  it('upserts an auto-deposit rule and invalidates the source’s rules', async () => {
    const builder = mockFromResult({
      id: 'rule-1',
      household_id: 'household-1',
      source_id: 'source-1',
      amount: '300.00',
      day_of_month_1: 1,
      day_of_month_2: 15,
      start_date: '2026-07-01',
      active: true,
      last_generated_date: null,
      description: 'Paycheck',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    })
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useSaveSavingsDepositRule(), {
      wrapper,
    })
    result.current.mutate({
      id: 'rule-1',
      sourceId: 'source-1',
      amount: 300,
      dayOfMonth1: 1,
      dayOfMonth2: 15,
      startDate: '2026-07-01',
      active: true,
      description: 'Paycheck',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        id: 'rule-1',
        source_id: 'source-1',
        amount: 300,
        day_of_month_1: 1,
        day_of_month_2: 15,
        start_date: '2026-07-01',
        active: true,
        description: 'Paycheck',
      },
      { onConflict: 'id' },
    )
    expect(result.current.data?.amount).toBe(300)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: savingsKeys.rules('source-1'),
    })
  })
})
