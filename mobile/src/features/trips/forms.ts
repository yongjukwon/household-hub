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
