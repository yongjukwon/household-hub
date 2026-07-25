import {
  type Cents,
  type CurrencyCode,
  isCents,
  isCurrencyCode,
  isRecord,
} from './validation'

export type TripCurrencyAmount = {
  currency: CurrencyCode
  amountCents: Cents
}

export type TripCurrencyBucket = {
  currency: CurrencyCode
  totalCents: Cents
}

export function isTripCurrencyAmount(value: unknown): value is TripCurrencyAmount {
  return isRecord(value) && isCurrencyCode(value.currency) && isCents(value.amountCents)
}

/** Adds amounts only within the same currency; foreign amounts are never converted. */
export function aggregateTripCurrencyBuckets(
  amounts: readonly TripCurrencyAmount[],
): TripCurrencyBucket[] {
  const totals = new Map<CurrencyCode, Cents>()

  for (const { currency, amountCents } of amounts) {
    const total = (totals.get(currency) ?? 0) + amountCents
    if (!isCents(total)) {
      throw new RangeError(`Trip total for ${currency} exceeds safe integer cents`)
    }
    totals.set(currency, total)
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, totalCents]) => ({ currency, totalCents }))
}
