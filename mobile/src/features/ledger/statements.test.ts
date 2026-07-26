import {
  applyLedgerConfigurationOverlay,
  categoryProgress,
  ensureLedgerYearMonths,
  hasSpendingFromMonth,
  monthSummaries,
  resolveTransactionPrerequisite,
  spendingCategoryTotals,
  statementTotals,
  type LedgerYearData,
} from '@/features/ledger/statements'
import { QueryClient } from '@tanstack/react-query'
import {
  queryKeys,
  type OperationCommand,
  type OperationType,
} from '@household-hub/domain'
import { seedPendingLedgerYear } from '@/features/ledger/statements'
import type { QueuedOperation } from '@/lib/operations'

describe('ensureLedgerYearMonths', () => {
  it('supplies a usable twelve-month shell while a new year is still queued', () => {
    const result = ensureLedgerYearMonths(
      '11111111-1111-4111-8111-111111111111',
      { months: [], categories: [], limits: [], transactions: [] },
    )

    expect(result.months).toHaveLength(12)
    expect(result.months.map((entry) => entry.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
    expect(result.months[0].id).toBe(
      '11111111-1111-4111-8111-111111111111:month:1',
    )
  })

  it('preserves authoritative server months', () => {
    const data = {
      months: [{ id: 'server-month', month: 1 }],
      categories: [],
      limits: [],
      transactions: [],
    }

    expect(ensureLedgerYearMonths('year-id', data)).toBe(data)
  })
})

describe('seedPendingLedgerYear', () => {
  it('puts an offline-created year and its twelve-month Budget shell in cache', () => {
    const client = new QueryClient()
    const householdId = '11111111-1111-4111-8111-111111111111'
    const yearId = '22222222-2222-4222-8222-222222222222'

    seedPendingLedgerYear(client, householdId, yearId, 2027)

    expect(client.getQueryData(queryKeys.ledger.years(householdId))).toEqual([
      { id: yearId, year: 2027, revision: 1 },
    ])
    expect(
      client.getQueryData<LedgerYearData>([
        ...queryKeys.ledger.years(householdId),
        yearId,
      ])?.months,
    ).toHaveLength(12)
    client.clear()
  })
})

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  id: `m${i + 1}`,
  month: i + 1,
}))

function data(over: Partial<LedgerYearData>): LedgerYearData {
  return {
    months: MONTHS,
    categories: [],
    limits: [],
    transactions: [],
    ...over,
  }
}

function queued(input: {
  localSequence: number
  entityType: string
  entityId: string
  type: OperationType
  payload: Record<string, unknown>
  optimistic?: Record<string, unknown> | null
}): QueuedOperation {
  const operationId = `00000000-0000-4000-8000-${String(input.localSequence).padStart(12, '0')}`
  const enqueuedAt = '2026-07-26T00:00:00.000Z'
  return {
    operationId,
    localSequence: input.localSequence,
    householdId: '11111111-1111-4111-8111-111111111111',
    entityType: input.entityType,
    entityId: input.entityId,
    command: {
      schemaVersion: 1,
      operationId,
      deviceId: '22222222-2222-4222-8222-222222222222',
      localSequence: input.localSequence,
      householdId: '11111111-1111-4111-8111-111111111111',
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      baseRevision: null,
      enqueuedAt,
      payload: input.payload,
    } as OperationCommand,
    optimistic:
      input.optimistic === undefined ? input.payload : input.optimistic,
    enqueuedAt,
    attempts: 0,
    lastError: null,
  }
}

describe('applyLedgerConfigurationOverlay', () => {
  it('shows a queued category and limit from the selected month through December', () => {
    const result = applyLedgerConfigurationOverlay(
      data({}),
      [
        queued({
          localSequence: 1,
          entityType: 'ledger_category',
          entityId: 'food',
          type: 'ledger.category.upsert',
          payload: {
            yearId: 'year',
            fromMonth: 7,
            name: 'Food',
            kind: 'spending',
            sortOrder: 0,
          },
        }),
        queued({
          localSequence: 2,
          entityType: 'ledger_limit',
          entityId: 'food',
          type: 'ledger.limit.upsert',
          payload: {
            categoryId: 'food',
            fromMonth: 7,
            amountCents: 40_000,
          },
        }),
      ],
      'year',
    )

    expect(result.categories.map((row) => row.monthId)).toEqual([
      'm7',
      'm8',
      'm9',
      'm10',
      'm11',
      'm12',
    ])
    expect(categoryProgress(result, 'm7')[0]).toMatchObject({
      name: 'Food',
      limitCents: 40_000,
    })
  })

  it('applies queued edits and deletes in FIFO order', () => {
    const initial = data({
      categories: MONTHS.slice(6).map((month) => ({
        id: `food:${month.id}`,
        categoryId: 'food',
        monthId: month.id,
        name: 'Food',
        kind: 'spending' as const,
        sortOrder: 0,
        revision: 1,
      })),
    })
    const result = applyLedgerConfigurationOverlay(
      initial,
      [
        queued({
          localSequence: 2,
          entityType: 'ledger_category',
          entityId: 'food',
          type: 'ledger.category.upsert',
          payload: {
            yearId: 'year',
            fromMonth: 7,
            name: 'Dining',
            kind: 'spending',
            sortOrder: 0,
          },
        }),
        queued({
          localSequence: 3,
          entityType: 'ledger_category',
          entityId: 'food',
          type: 'ledger.category.delete',
          payload: { fromMonth: 10 },
          optimistic: null,
        }),
      ],
      'year',
    )

    expect(result.categories.map((row) => [row.monthId, row.name])).toEqual([
      ['m7', 'Dining'],
      ['m8', 'Dining'],
      ['m9', 'Dining'],
    ])
  })

  it('ignores configuration commands belonging to another year', () => {
    const initial = data({})
    const result = applyLedgerConfigurationOverlay(
      initial,
      [
        queued({
          localSequence: 1,
          entityType: 'ledger_category',
          entityId: 'food',
          type: 'ledger.category.upsert',
          payload: {
            yearId: 'other-year',
            fromMonth: 1,
            name: 'Food',
            kind: 'spending',
            sortOrder: 0,
          },
        }),
      ],
      'year',
    )

    expect(result).toEqual(initial)
  })
})

describe('resolveTransactionPrerequisite', () => {
  const income = {
    id: 'income-row',
    categoryId: 'income',
    monthId: 'm7',
    name: 'Salary',
    kind: 'income' as const,
    sortOrder: 0,
    revision: 1,
  }

  it('requires a CAD Asset before checking categories', () => {
    expect(resolveTransactionPrerequisite('income', false, [income])).toBe(
      'asset',
    )
  })

  it('requires a matching category after an Asset exists', () => {
    expect(resolveTransactionPrerequisite('spending', true, [income])).toBe(
      'category',
    )
  })

  it('allows the transaction when both prerequisites exist', () => {
    expect(resolveTransactionPrerequisite('income', true, [income])).toBeNull()
  })
})

describe('monthSummaries', () => {
  it('sums income and spending per month and computes net', () => {
    const d = data({
      transactions: [
        { id: 't1', monthId: 'm7', categoryId: 'c1', assetId: 'a', kind: 'income', amountCents: 500_00, occurredAt: '', description: '', revision: 1 },
        { id: 't2', monthId: 'm7', categoryId: 'c2', assetId: 'a', kind: 'spending', amountCents: 120_00, occurredAt: '', description: '', revision: 1 },
        { id: 't3', monthId: 'm8', categoryId: 'c2', assetId: 'a', kind: 'spending', amountCents: 30_00, occurredAt: '', description: '', revision: 1 },
      ],
    })
    const july = monthSummaries(d).find((s) => s.month === 7)!
    expect(july).toMatchObject({ incomeCents: 500_00, spendingCents: 120_00, netCents: 380_00 })
    const august = monthSummaries(d).find((s) => s.month === 8)!
    expect(august).toMatchObject({ incomeCents: 0, spendingCents: 30_00, netCents: -30_00 })
  })
})

describe('categoryProgress', () => {
  it('computes spend-vs-limit ratio and over-limit flag for a month', () => {
    const d = data({
      categories: [
        { id: 'mc1', categoryId: 'c1', monthId: 'm7', name: 'Groceries', kind: 'spending', sortOrder: 0, revision: 1 },
        { id: 'mc2', categoryId: 'c2', monthId: 'm7', name: 'Rent', kind: 'spending', sortOrder: 1, revision: 1 },
      ],
      limits: [
        { categoryId: 'c1', monthId: 'm7', amountCents: 100_00, limitEntityId: 'c1', revision: 1 },
        { categoryId: 'c2', monthId: 'm7', amountCents: null, limitEntityId: 'c2', revision: 1 },
      ],
      transactions: [
        { id: 't1', monthId: 'm7', categoryId: 'c1', assetId: 'a', kind: 'spending', amountCents: 120_00, occurredAt: '', description: '', revision: 1 },
      ],
    })
    const rows = categoryProgress(d, 'm7')
    expect(rows[0]).toMatchObject({
      name: 'Groceries',
      limitCents: 100_00,
      actualCents: 120_00,
      overLimit: true,
    })
    expect(rows[0].ratio).toBeCloseTo(1.2)
    // No limit → null ratio, not over limit.
    expect(rows[1]).toMatchObject({ limitCents: null, ratio: null, overLimit: false })
  })

  it('orders by sortOrder then name', () => {
    const d = data({
      categories: [
        { id: 'mc2', categoryId: 'c2', monthId: 'm7', name: 'Zebra', kind: 'spending', sortOrder: 0, revision: 1 },
        { id: 'mc1', categoryId: 'c1', monthId: 'm7', name: 'Apple', kind: 'spending', sortOrder: 1, revision: 1 },
      ],
    })
    expect(categoryProgress(d, 'm7').map((r) => r.name)).toEqual(['Zebra', 'Apple'])
  })
})

describe('hasSpendingFromMonth', () => {
  it('is true when a later month has spending', () => {
    const d = data({
      transactions: [
        { id: 't1', monthId: 'm9', categoryId: 'c1', assetId: 'a', kind: 'spending', amountCents: 10_00, occurredAt: '', description: '', revision: 1 },
      ],
    })
    expect(hasSpendingFromMonth(d, 'c1', 7)).toBe(true)
    expect(hasSpendingFromMonth(d, 'c1', 10)).toBe(false)
  })
})

describe('statement calculations', () => {
  const statement = data({
    categories: [
      { id: 'mc-income', categoryId: 'income', monthId: 'm7', name: 'Salary', kind: 'income', sortOrder: 0, revision: 1 },
      { id: 'mc-grocery-7', categoryId: 'grocery', monthId: 'm7', name: 'Groceries', kind: 'spending', sortOrder: 0, revision: 1 },
      { id: 'mc-rent-7', categoryId: 'rent', monthId: 'm7', name: 'Rent', kind: 'spending', sortOrder: 1, revision: 1 },
      { id: 'mc-grocery-8', categoryId: 'grocery', monthId: 'm8', name: 'Groceries', kind: 'spending', sortOrder: 0, revision: 1 },
    ],
    limits: [
      { categoryId: 'income', monthId: 'm7', amountCents: 9_999_00, limitEntityId: 'li', revision: 1 },
      { categoryId: 'grocery', monthId: 'm7', amountCents: 400_00, limitEntityId: 'lg7', revision: 1 },
      { categoryId: 'rent', monthId: 'm7', amountCents: 600_00, limitEntityId: 'lr7', revision: 1 },
      { categoryId: 'grocery', monthId: 'm8', amountCents: 450_00, limitEntityId: 'lg8', revision: 1 },
    ],
    transactions: [
      { id: 'income-7', monthId: 'm7', categoryId: 'income', assetId: 'a', kind: 'income', amountCents: 2_000_00, occurredAt: '', description: 'Salary', revision: 1 },
      { id: 'grocery-7', monthId: 'm7', categoryId: 'grocery', assetId: 'a', kind: 'spending', amountCents: 250_00, occurredAt: '', description: 'Food', revision: 1 },
      { id: 'rent-7', monthId: 'm7', categoryId: 'rent', assetId: 'a', kind: 'spending', amountCents: 600_00, occurredAt: '', description: 'Rent', revision: 1 },
      { id: 'grocery-8', monthId: 'm8', categoryId: 'grocery', assetId: 'a', kind: 'spending', amountCents: 100_00, occurredAt: '', description: 'Food', revision: 1 },
    ],
  })

  it('calculates annual and monthly actuals from transactions', () => {
    expect(statementTotals(statement)).toEqual({
      incomeCents: 2_000_00,
      spendingCents: 950_00,
      limitCents: 1_450_00,
      leftCents: 500_00,
      utilization: 950 / 1_450,
    })
    expect(statementTotals(statement, 'm7')).toEqual({
      incomeCents: 2_000_00,
      spendingCents: 850_00,
      limitCents: 1_000_00,
      leftCents: 150_00,
      utilization: 0.85,
    })
  })

  it('returns null utilization when the spending limit is zero', () => {
    expect(statementTotals(data({}))).toMatchObject({
      limitCents: 0,
      leftCents: 0,
      utilization: null,
    })
  })

  it('groups annual spending by category', () => {
    expect(spendingCategoryTotals(statement)).toEqual([
      { categoryId: 'grocery', name: 'Groceries', totalCents: 350_00 },
      { categoryId: 'rent', name: 'Rent', totalCents: 600_00 },
    ])
  })
})
