import { describe, expect, it } from 'vitest'
import {
  aggregateTripCurrencyBuckets,
  isTripCurrencyAmount,
  type Cents,
  type CurrencyCode,
} from './index'

const CAD = 'CAD' as CurrencyCode
const GBP = 'GBP' as CurrencyCode
const JPY = 'JPY' as CurrencyCode
const cents = (value: number) => value as Cents

describe('aggregateTripCurrencyBuckets', () => {
  it('groups trip expenses by currency without converting their amounts', () => {
    expect(
      aggregateTripCurrencyBuckets([
        { currency: GBP, amountCents: cents(240900) },
        { currency: CAD, amountCents: cents(500000) },
        { currency: CAD, amountCents: cents(30900) },
      ]),
    ).toEqual([
      { currency: 'CAD', totalCents: 530900 },
      { currency: 'GBP', totalCents: 240900 },
    ])
  })

  it('keeps a foreign-currency adjustment in its own bucket', () => {
    expect(
      aggregateTripCurrencyBuckets([
        { currency: CAD, amountCents: cents(10000) },
        { currency: JPY, amountCents: cents(-1000) },
      ]),
    ).toEqual([
      { currency: 'CAD', totalCents: 10000 },
      { currency: 'JPY', totalCents: -1000 },
    ])
  })

  it('accepts only validated currency and cents contracts', () => {
    expect(isTripCurrencyAmount({ currency: 'CAD', amountCents: 100 })).toBe(true)
    expect(isTripCurrencyAmount({ currency: 'ZZZ', amountCents: 100 })).toBe(false)
    expect(isTripCurrencyAmount({ currency: 'CAD', amountCents: 1.5 })).toBe(false)
  })
})
