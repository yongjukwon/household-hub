import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@household-hub/domain'
import {
  householdTotalCents as sharedHouseholdTotalCents,
  mapLedgerAsset,
  mapLedgerTransfer,
  mapTransferSchedule,
  totalsByCurrency as sharedTotalsByCurrency,
} from '@household-hub/application/feature-data'
import { supabase } from '@/lib/supabase'
import { withOptimisticOverlay } from '@/lib/operations'
import type { Tables } from '@/types/database'

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

/** Household base currency. CAD contributes to the household total; others don't. */
export const HOUSEHOLD_CURRENCY = 'CAD'

/** Assets with live balances from the `ledger_asset_balances` view. */
export function useLedgerAssets(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId ? queryKeys.ledger.assets(householdId) : ['ledger', 'assets', 'off'],
    enabled: !!householdId,
    queryFn: async (): Promise<LedgerAsset[]> => {
      const { data, error } = await supabase
        .from('ledger_asset_balances')
        .select('*')
        .order('sort_order', { ascending: true })
        .returns<Tables<'ledger_asset_balances'>[]>()
      if (error) throw error
      return withOptimisticOverlay((data ?? [])
        .filter((r) => r.id)
        .map(mapLedgerAsset)
        .filter((asset): asset is LedgerAsset => asset !== null), 'ledger_asset')
    },
  })
}

/** Recent transfers between assets (newest first). */
export function useLedgerTransfers(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId
      ? [...queryKeys.ledger.assets(householdId), 'transfers']
      : ['ledger', 'transfers', 'off'],
    enabled: !!householdId,
    queryFn: async (): Promise<LedgerTransfer[]> => {
      const { data, error } = await supabase
        .from('ledger_transfers')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(50)
        .returns<Tables<'ledger_transfers'>[]>()
      if (error) throw error
      return withOptimisticOverlay((data ?? []).map(mapLedgerTransfer), 'ledger_transfer')
    },
  })
}

/** Recurring transfer schedules. */
export function useTransferSchedules(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId
      ? [...queryKeys.ledger.assets(householdId), 'schedules']
      : ['ledger', 'schedules', 'off'],
    enabled: !!householdId,
    queryFn: async (): Promise<TransferSchedule[]> => {
      const { data, error } = await supabase
        .from('ledger_transfer_schedules')
        .select('*')
        .order('created_at', { ascending: true })
        .returns<Tables<'ledger_transfer_schedules'>[]>()
      if (error) throw error
      return withOptimisticOverlay((data ?? []).map(mapTransferSchedule), 'ledger_schedule')
    },
  })
}

/** A per-currency subtotal for display. */
export interface CurrencyTotal {
  currencyCode: string
  totalCents: number
}

/**
 * Groups asset balances by currency. CAD is the household total; foreign
 * currencies are surfaced separately and never converted.
 */
export function totalsByCurrency(assets: LedgerAsset[]): CurrencyTotal[] {
  return sharedTotalsByCurrency(assets)
}

/** The household (CAD-only) net total in cents. */
export function householdTotalCents(assets: LedgerAsset[]): number {
  return sharedHouseholdTotalCents(assets)
}
