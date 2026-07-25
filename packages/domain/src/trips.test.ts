import { describe, expect, it } from 'vitest'
import { aggregateTripCurrencyBuckets } from './index'

describe('aggregateTripCurrencyBuckets', () => {
  it('groups trip expenses by currency without converting their amounts', () => {
    expect(
      aggregateTripCurrencyBuckets([
        { currency: 'GBP', amountCents: 240900 },
        { currency: 'CAD', amountCents: 500000 },
        { currency: 'CAD', amountCents: 30900 },
      ]),
    ).toEqual([
      { currency: 'CAD', totalCents: 530900 },
      { currency: 'GBP', totalCents: 240900 },
    ])
  })

  it('keeps a foreign-currency adjustment in its own bucket', () => {
    expect(
      aggregateTripCurrencyBuckets([
        { currency: 'CAD', amountCents: 10000 },
        { currency: 'JPY', amountCents: -1000 },
      ]),
    ).toEqual([
      { currency: 'CAD', totalCents: 10000 },
      { currency: 'JPY', totalCents: -1000 },
    ])
  })
})
