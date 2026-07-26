import type { LedgerAsset } from '@/features/ledger/assets'

export function normalizeCurrencyInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
}

export function compatibleExpenseAssets(
  assets: LedgerAsset[],
  currency: string,
): LedgerAsset[] {
  const normalized = currency.trim().toUpperCase()
  return assets.filter((asset) => asset.currencyCode === normalized)
}

export interface ExpenseLinkIds {
  itineraryEntryId: string | null
  bookingEntryId: string | null
}

/** Converts the single expense-link picker value into the two nullable RPC fields. */
export function parseExpenseLink(value: string): ExpenseLinkIds {
  if (value.startsWith('itinerary:')) {
    return {
      itineraryEntryId: value.slice('itinerary:'.length),
      bookingEntryId: null,
    }
  }
  if (value.startsWith('booking:')) {
    return {
      itineraryEntryId: null,
      bookingEntryId: value.slice('booking:'.length),
    }
  }
  return { itineraryEntryId: null, bookingEntryId: null }
}

export function expenseLinkValue(link: ExpenseLinkIds): string {
  if (link.itineraryEntryId) return `itinerary:${link.itineraryEntryId}`
  if (link.bookingEntryId) return `booking:${link.bookingEntryId}`
  return 'standalone'
}
