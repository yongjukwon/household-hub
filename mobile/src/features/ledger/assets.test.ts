import {
  householdTotalCents,
  totalsByCurrency,
  type LedgerAsset,
} from '@/features/ledger/assets'

function asset(over: Partial<LedgerAsset>): LedgerAsset {
  return {
    id: crypto.randomUUID(),
    name: 'Chequing',
    kind: 'checking',
    currencyCode: 'CAD',
    balanceCents: 0,
    sortOrder: 0,
    revision: 1,
    ...over,
  }
}

describe('householdTotalCents', () => {
  it('sums only CAD balances', () => {
    const assets = [
      asset({ currencyCode: 'CAD', balanceCents: 100_00 }),
      asset({ currencyCode: 'CAD', balanceCents: 50_00 }),
      asset({ currencyCode: 'USD', balanceCents: 999_00 }),
    ]
    expect(householdTotalCents(assets)).toBe(150_00)
  })

  it('includes negative balances (e.g. credit)', () => {
    const assets = [
      asset({ currencyCode: 'CAD', balanceCents: 100_00 }),
      asset({ currencyCode: 'CAD', kind: 'credit', balanceCents: -30_00 }),
    ]
    expect(householdTotalCents(assets)).toBe(70_00)
  })
})

describe('totalsByCurrency', () => {
  it('groups by currency with CAD first', () => {
    const totals = totalsByCurrency([
      asset({ currencyCode: 'USD', balanceCents: 200_00 }),
      asset({ currencyCode: 'CAD', balanceCents: 100_00 }),
      asset({ currencyCode: 'EUR', balanceCents: 300_00 }),
      asset({ currencyCode: 'CAD', balanceCents: 50_00 }),
    ])
    expect(totals).toEqual([
      { currencyCode: 'CAD', totalCents: 150_00 },
      { currencyCode: 'EUR', totalCents: 300_00 },
      { currencyCode: 'USD', totalCents: 200_00 },
    ])
  })
})
