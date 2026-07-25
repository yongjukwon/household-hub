import {
  type Cents,
  type Revision,
  type UUID,
  isCents,
  isIsoDateTime,
  isRecord,
  isRevision,
  isUuid,
} from './validation'

export const operationTypes = [
  'calendar.event.upsert',
  'calendar.event.delete',
  'grocery.list.upsert',
  'grocery.list.delete',
  'grocery.item.upsert',
  'grocery.item.delete',
  'ledger.asset.upsert',
  'ledger.asset.delete',
  'ledger.year.clear',
  'ledger.category.upsert',
  'ledger.category.delete',
  'ledger.limit.upsert',
  'ledger.limit.delete',
  'ledger.transaction.upsert',
  'ledger.transaction.delete',
  'ledger.transfer.upsert',
  'ledger.transfer.delete',
  'ledger.schedule.upsert',
  'ledger.schedule.delete',
  'note.upsert',
  'note.delete',
  'trip.upsert',
  'trip.delete',
  'trip.expense.upsert',
  'trip.expense.delete',
  'notification.read',
  'settings.update',
] as const

export type OperationType = (typeof operationTypes)[number]

export type OperationCommand = {
  schemaVersion: 1
  operationId: UUID
  deviceId: UUID
  localSequence: number
  householdId: UUID
  type: OperationType
  entityType: string
  entityId: UUID
  baseRevision: Revision | null
  enqueuedAt: string
  payload: Record<string, unknown>
}

export type NegativeAssetBalanceWarning = {
  code: 'negative_asset_balance'
  assetId: UUID
  balanceCents: Cents
}

export type OperationWarning = NegativeAssetBalanceWarning

export type ConflictWinner = {
  operationId: UUID
  type: OperationType
  entityType: string
  entityId: UUID
  appliedAt: string
}

export type OperationResult =
  | {
      status: 'applied'
      operationId: UUID
      serverSequence: number
      entityRevision?: Revision
      warning?: OperationWarning
    }
  | {
      status: 'duplicate'
      operationId: UUID
      serverSequence: number
    }
  | {
      status: 'conflict'
      operationId: UUID
      reason: string
      currentRevision: Revision
      winner: ConflictWinner
    }

export function isOperationType(value: unknown): value is OperationType {
  return typeof value === 'string' && operationTypes.includes(value as OperationType)
}

export function isOperationCommand(value: unknown): value is OperationCommand {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    isUuid(value.operationId) &&
    isUuid(value.deviceId) &&
    isNonnegativeSafeInteger(value.localSequence) &&
    isUuid(value.householdId) &&
    isOperationType(value.type) &&
    typeof value.entityType === 'string' &&
    value.entityType.trim().length > 0 &&
    isUuid(value.entityId) &&
    (value.baseRevision === null || isRevision(value.baseRevision)) &&
    isIsoDateTime(value.enqueuedAt) &&
    isRecord(value.payload)
  )
}

export function isOperationResult(value: unknown): value is OperationResult {
  if (!isRecord(value) || !isUuid(value.operationId)) return false

  switch (value.status) {
    case 'applied':
      return (
        isNonnegativeSafeInteger(value.serverSequence) &&
        isOptional(value.entityRevision, isRevision) &&
        isOptional(value.warning, isOperationWarning)
      )
    case 'duplicate':
      return isNonnegativeSafeInteger(value.serverSequence)
    case 'conflict':
      return (
        typeof value.reason === 'string' &&
        value.reason.trim().length > 0 &&
        isRevision(value.currentRevision) &&
        isConflictWinner(value.winner)
      )
    default:
      return false
  }
}

function isOperationWarning(value: unknown): value is OperationWarning {
  return (
    isRecord(value) &&
    value.code === 'negative_asset_balance' &&
    isUuid(value.assetId) &&
    isCents(value.balanceCents)
  )
}

function isConflictWinner(value: unknown): value is ConflictWinner {
  return (
    isRecord(value) &&
    isUuid(value.operationId) &&
    isOperationType(value.type) &&
    typeof value.entityType === 'string' &&
    value.entityType.trim().length > 0 &&
    isUuid(value.entityId) &&
    isIsoDateTime(value.appliedAt)
  )
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isOptional<T>(
  value: unknown,
  predicate: (candidate: unknown) => candidate is T,
): boolean {
  return value === undefined || predicate(value)
}
