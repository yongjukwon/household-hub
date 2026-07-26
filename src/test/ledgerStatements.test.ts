import { describe, expect, it } from 'vitest'
import {
  categoryProgress,
  hasSpendingFromMonth,
  monthSummaries,
  spendingCategoryTotals,
  statementTotals,
  type LedgerYearData,
} from '@/features/ledger/statements'

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
