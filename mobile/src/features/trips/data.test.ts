import { expenseBuckets, type TripExpense } from '@/features/trips/data'

function expense(over: Partial<TripExpense>): TripExpense {
  return {
    id: crypto.randomUUID(),
    tripId: 't1',
    assetId: 'a1',
    amountCents: 0,
    currencyCode: 'CAD',
    description: '',
    spentAt: '2026-07-10T12:00:00Z',
    revision: 1,
    ...over,
  }
}

describe('expenseBuckets', () => {
  it('keeps CAD and destination-currency totals separate (no conversion)', () => {
    const buckets = expenseBuckets([
      expense({ currencyCode: 'CAD', amountCents: 100_00 }),
      expense({ currencyCode: 'JPY', amountCents: 5000_00 }),
      expense({ currencyCode: 'CAD', amountCents: 25_00 }),
    ])
    expect(buckets).toEqual([
      { currency: 'CAD', totalCents: 125_00 },
      { currency: 'JPY', totalCents: 5000_00 },
    ])
  })

  it('returns an empty array when there are no expenses', () => {
    expect(expenseBuckets([])).toEqual([])
  })
})
