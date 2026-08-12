export type AssetKind =
  | 'cash'
  | 'checking'
  | 'savings'
  | 'credit'
  | 'investment'
  | 'other'

export interface LedgerAsset {
  id: string
  name: string
  kind: AssetKind
  currencyCode: string
  balanceCents: number
  sortOrder: number
  revision: number
}

export interface LedgerTransfer {
  id: string
  fromAssetId: string
  toAssetId: string
  amountCents: number
  occurredAt: string
  note: string | null
  scheduleId: string | null
  revision: number
}

export type TransferFrequency = 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly'

export interface TransferSchedule {
  id: string
  fromAssetId: string
  toAssetId: string
  amountCents: number
  frequency: TransferFrequency
  startsAt: string
  timezone: string
  active: boolean
  revision: number
}

export interface LedgerAssetRow {
  id: string | null
  name: string | null
  kind: string | null
  currency_code: string | null
  balance_cents: number | null
  sort_order: number | null
  revision: number | null
}

export interface LedgerTransferRow {
  id: string
  from_asset_id: string
  to_asset_id: string
  amount_cents: number
  occurred_at: string
  note: string | null
  schedule_id: string | null
  revision: number
}

export interface TransferScheduleRow {
  id: string
  from_asset_id: string
  to_asset_id: string
  amount_cents: number
  frequency: string
  starts_at: string
  timezone: string
  active: boolean
  revision: number
}

export const HOUSEHOLD_CURRENCY = 'CAD'

export function mapLedgerAsset(row: LedgerAssetRow): LedgerAsset | null {
  if (!row.id) return null
  return {
    id: row.id,
    name: row.name ?? '',
    kind: (row.kind ?? 'other') as AssetKind,
    currencyCode: row.currency_code ?? HOUSEHOLD_CURRENCY,
    balanceCents: row.balance_cents ?? 0,
    sortOrder: row.sort_order ?? 0,
    revision: row.revision ?? 1,
  }
}

export function mapLedgerTransfer(row: LedgerTransferRow): LedgerTransfer {
  return {
    id: row.id,
    fromAssetId: row.from_asset_id,
    toAssetId: row.to_asset_id,
    amountCents: row.amount_cents,
    occurredAt: row.occurred_at,
    note: row.note,
    scheduleId: row.schedule_id,
    revision: row.revision,
  }
}

export function mapTransferSchedule(row: TransferScheduleRow): TransferSchedule {
  return {
    id: row.id,
    fromAssetId: row.from_asset_id,
    toAssetId: row.to_asset_id,
    amountCents: row.amount_cents,
    frequency: row.frequency as TransferFrequency,
    startsAt: row.starts_at,
    timezone: row.timezone,
    active: row.active,
    revision: row.revision,
  }
}

export interface CurrencyTotal {
  currencyCode: string
  totalCents: number
}

export function totalsByCurrency(assets: LedgerAsset[]): CurrencyTotal[] {
  const totals = new Map<string, number>()
  for (const asset of assets) {
    totals.set(
      asset.currencyCode,
      (totals.get(asset.currencyCode) ?? 0) + asset.balanceCents,
    )
  }
  return [...totals.entries()]
    .map(([currencyCode, totalCents]) => ({ currencyCode, totalCents }))
    .sort((left, right) => {
      if (left.currencyCode === HOUSEHOLD_CURRENCY) return -1
      if (right.currencyCode === HOUSEHOLD_CURRENCY) return 1
      return left.currencyCode.localeCompare(right.currencyCode)
    })
}

export function householdTotalCents(assets: LedgerAsset[]): number {
  return assets
    .filter((asset) => asset.currencyCode === HOUSEHOLD_CURRENCY)
    .reduce((sum, asset) => sum + asset.balanceCents, 0)
}
