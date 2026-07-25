export type TripCurrencyAmount = {
  currency: string
  amountCents: number
}

export type TripCurrencyBucket = {
  currency: string
  totalCents: number
}

/** Adds amounts only within the same currency; foreign amounts are never converted. */
export function aggregateTripCurrencyBuckets(
  amounts: readonly TripCurrencyAmount[],
): TripCurrencyBucket[] {
  const totals = new Map<string, number>()

  for (const { currency, amountCents } of amounts) {
    const total = (totals.get(currency) ?? 0) + amountCents
    if (!Number.isSafeInteger(total)) {
      throw new RangeError(`Trip total for ${currency} exceeds safe integer cents`)
    }
    totals.set(currency, total)
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, totalCents]) => ({ currency, totalCents }))
}
