import { enqueueOperation, type EnqueueOutcome } from '@/lib/operations'
import type {
  AssetKind,
  TransferFrequency,
  TransferSchedule,
} from './assets'

export interface AssetInput {
  id: string
  name: string
  kind: AssetKind
  currency: string
  balanceCents: number
  sortOrder: number
}

/**
 * Create/edit an asset. `balanceCents` is the *desired* balance; the server
 * reconciles it with an adjustment posting so the asset ledger stays balanced.
 */
export function saveAsset(
  householdId: string,
  input: AssetInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    name: input.name.trim(),
    kind: input.kind,
    currency: input.currency,
    balanceCents: input.balanceCents,
    sortOrder: input.sortOrder,
  }
  return enqueueOperation({
    householdId,
    type: 'ledger.asset.upsert',
    entityType: 'ledger_asset',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: {
      ...payload,
      currencyCode: payload.currency,
      revision: baseRevision ?? 1,
    },
  })
}

export function deleteAsset(
  householdId: string,
  assetId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'ledger.asset.delete',
    entityType: 'ledger_asset',
    entityId: assetId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}

export interface TransferInput {
  id: string
  fromAssetId: string
  toAssetId: string
  amountCents: number
  occurredAt: string
  note: string | null
}

export function saveTransfer(
  householdId: string,
  input: TransferInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    fromAssetId: input.fromAssetId,
    toAssetId: input.toAssetId,
    amountCents: input.amountCents,
    occurredAt: input.occurredAt,
    note: input.note && input.note.trim().length > 0 ? input.note.trim() : null,
  }
  return enqueueOperation({
    householdId,
    type: 'ledger.transfer.upsert',
    entityType: 'ledger_transfer',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: { ...payload, scheduleId: null, revision: baseRevision ?? 1 },
  })
}

export function deleteTransfer(
  householdId: string,
  transferId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'ledger.transfer.delete',
    entityType: 'ledger_transfer',
    entityId: transferId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}

export interface ScheduleInput {
  id: string
  fromAssetId: string
  toAssetId: string
  amountCents: number
  frequency: TransferFrequency
  startsAt: string
  timezone: string
  active: boolean
}

export function saveSchedule(
  householdId: string,
  input: ScheduleInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    fromAssetId: input.fromAssetId,
    toAssetId: input.toAssetId,
    amountCents: input.amountCents,
    frequency: input.frequency,
    startsAt: input.startsAt,
    timezone: input.timezone,
    active: input.active,
  }
  return enqueueOperation({
    householdId,
    type: 'ledger.schedule.upsert',
    entityType: 'ledger_schedule',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: { ...payload, revision: baseRevision ?? 1 },
  })
}

/** Pause/resume a recurring transfer, preserving its other fields. */
export function toggleSchedule(
  householdId: string,
  schedule: TransferSchedule,
  active: boolean,
): Promise<EnqueueOutcome> {
  return saveSchedule(
    householdId,
    {
      id: schedule.id,
      fromAssetId: schedule.fromAssetId,
      toAssetId: schedule.toAssetId,
      amountCents: schedule.amountCents,
      frequency: schedule.frequency,
      startsAt: schedule.startsAt,
      timezone: schedule.timezone,
      active,
    },
    schedule.revision,
  )
}

export function deleteSchedule(
  householdId: string,
  scheduleId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'ledger.schedule.delete',
    entityType: 'ledger_schedule',
    entityId: scheduleId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}
