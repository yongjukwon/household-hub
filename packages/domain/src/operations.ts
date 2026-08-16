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
import { isMobileNavigation, type MobileNavigation } from './mobileNavigation'

export const operationTypes = [
  'calendar.event.upsert',
  'calendar.event.delete',
  'grocery.list.upsert',
  'grocery.list.delete',
  'grocery.item.upsert',
  'grocery.item.delete',
  'ledger.asset.upsert',
  'ledger.asset.delete',
  'ledger.year.upsert',
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
  'trip.itinerary.upsert',
  'trip.itinerary.delete',
  'trip.booking.upsert',
  'trip.booking.delete',
  'trip.checklist.upsert',
  'trip.checklist.delete',
  'notification.read',
  'notification.delete',
  'notification.clear',
  'settings.update',
] as const

export type OperationType = (typeof operationTypes)[number]

export const operationEntityTypes = {
  'calendar.event.upsert': 'calendar_event',
  'calendar.event.delete': 'calendar_event',
  'grocery.list.upsert': 'grocery_list',
  'grocery.list.delete': 'grocery_list',
  'grocery.item.upsert': 'grocery_item',
  'grocery.item.delete': 'grocery_item',
  'ledger.asset.upsert': 'ledger_asset',
  'ledger.asset.delete': 'ledger_asset',
  'ledger.year.upsert': 'ledger_year',
  'ledger.year.clear': 'ledger_year',
  'ledger.category.upsert': 'ledger_category',
  'ledger.category.delete': 'ledger_category',
  'ledger.limit.upsert': 'ledger_limit',
  'ledger.limit.delete': 'ledger_limit',
  'ledger.transaction.upsert': 'ledger_transaction',
  'ledger.transaction.delete': 'ledger_transaction',
  'ledger.transfer.upsert': 'ledger_transfer',
  'ledger.transfer.delete': 'ledger_transfer',
  'ledger.schedule.upsert': 'ledger_schedule',
  'ledger.schedule.delete': 'ledger_schedule',
  'note.upsert': 'note',
  'note.delete': 'note',
  'trip.upsert': 'trip',
  'trip.delete': 'trip',
  'trip.expense.upsert': 'trip_expense',
  'trip.expense.delete': 'trip_expense',
  'trip.itinerary.upsert': 'trip_itinerary_entry',
  'trip.itinerary.delete': 'trip_itinerary_entry',
  'trip.booking.upsert': 'trip_booking_entry',
  'trip.booking.delete': 'trip_booking_entry',
  'trip.checklist.upsert': 'trip_checklist_entry',
  'trip.checklist.delete': 'trip_checklist_entry',
  'notification.read': 'notification',
  'notification.delete': 'notification',
  'notification.clear': 'notification',
  'settings.update': 'settings',
} as const satisfies Record<OperationType, string>

export type OperationEntityType =
  (typeof operationEntityTypes)[OperationType]

export function operationEntityType(type: OperationType): OperationEntityType {
  return operationEntityTypes[type]
}

export interface LegacyGroceryItemUpsertPayload {
  listId: UUID
  name: string
  quantity: string | null
  checked: boolean
  unitPriceCents: Cents | null
  sortOrder: number
}

export interface CanonicalGroceryItemUpsertPayload
  extends LegacyGroceryItemUpsertPayload {
  purchaseQuantity: number | null
  totalPriceCents: Cents | null
  purchaseOccurrenceId: UUID | null
}

export type GroceryItemUpsertPayload =
  | LegacyGroceryItemUpsertPayload
  | CanonicalGroceryItemUpsertPayload

export interface SettingsUpdatePayload {
  displayName?: string
  appearance?: 'light' | 'dark' | 'system'
  notificationsEnabled?: boolean
  mobileNavigation?: MobileNavigation
  suppressUnpricedPurchaseWarning?: boolean
}

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
      details?: Record<string, unknown>
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
  | {
      status: 'rejected'
      operationId: UUID
      code: string
      reason: string
      details: Record<string, unknown>
      warnings: OperationWarning[]
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
    value.entityType === operationEntityType(value.type) &&
    isUuid(value.entityId) &&
    (value.baseRevision === null || isRevision(value.baseRevision)) &&
    isIsoDateTime(value.enqueuedAt) &&
    isRecord(value.payload) &&
    isOperationPayload(value.type, value.payload)
  )
}

export function isOperationResult(value: unknown): value is OperationResult {
  if (!isRecord(value) || !isUuid(value.operationId)) return false

  switch (value.status) {
    case 'applied':
      return (
        isNonnegativeSafeInteger(value.serverSequence) &&
        isOptional(value.entityRevision, isRevision) &&
        isOptional(value.warning, isOperationWarning) &&
        isOptional(value.details, isRecord)
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
    case 'rejected':
      return (
        typeof value.code === 'string' &&
        value.code.trim().length > 0 &&
        typeof value.reason === 'string' &&
        value.reason.trim().length > 0 &&
        isRecord(value.details) &&
        Array.isArray(value.warnings) &&
        value.warnings.every(isOperationWarning)
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
    value.entityType === operationEntityType(value.type) &&
    isUuid(value.entityId) &&
    isIsoDateTime(value.appliedAt)
  )
}

export function isGroceryItemUpsertPayload(
  value: unknown,
): value is GroceryItemUpsertPayload {
  if (!isRecord(value)) return false

  const legacyKeys = [
    'listId',
    'name',
    'quantity',
    'checked',
    'unitPriceCents',
    'sortOrder',
  ] as const
  const canonicalKeys = [
    'purchaseQuantity',
    'totalPriceCents',
    'purchaseOccurrenceId',
  ] as const
  const keys = Object.keys(value)
  const keySet = new Set(keys)
  const canonicalKeyCount = canonicalKeys.filter((key) => keySet.has(key)).length
  if (
    !legacyKeys.every((key) => keySet.has(key))
    || keys.some((key) =>
      !(legacyKeys as readonly string[]).includes(key)
      && !(canonicalKeys as readonly string[]).includes(key))
    || (canonicalKeyCount !== 0 && canonicalKeyCount !== canonicalKeys.length)
  ) {
    return false
  }

  if (
    !isUuid(value.listId)
    || typeof value.name !== 'string'
    || value.name.trim().length === 0
    || !(value.quantity === null || typeof value.quantity === 'string')
    || typeof value.checked !== 'boolean'
    || !isNullableSafeCents(value.unitPriceCents, true)
    || !isSignedInt32(value.sortOrder)
  ) {
    return false
  }

  if (canonicalKeyCount === 0) return true

  const purchaseQuantity = value.purchaseQuantity
  const totalPriceCents = value.totalPriceCents
  const occurrenceId = value.purchaseOccurrenceId
  if (
    !(purchaseQuantity === null
      || (typeof purchaseQuantity === 'number'
        && Number.isFinite(purchaseQuantity)
        && purchaseQuantity > 0))
    || !isNullableSafeCents(totalPriceCents, false)
    || !(occurrenceId === null || isUuid(occurrenceId))
    || (totalPriceCents !== null && purchaseQuantity === null)
    || value.checked !== (occurrenceId !== null)
  ) {
    return false
  }

  if (totalPriceCents === null) return value.unitPriceCents === null
  if (
    value.unitPriceCents === null
    || value.unitPriceCents <= 0
    || purchaseQuantity === null
  ) return false
  return value.unitPriceCents === Math.round(totalPriceCents / purchaseQuantity)
}

export function isSettingsUpdatePayload(
  value: unknown,
): value is SettingsUpdatePayload {
  if (!isRecord(value)) return false
  const allowedKeys = [
    'displayName',
    'appearance',
    'notificationsEnabled',
    'mobileNavigation',
    'suppressUnpricedPurchaseWarning',
  ] as const
  const keys = Object.keys(value)
  if (
    keys.length === 0
    || keys.some((key) => !(allowedKeys as readonly string[]).includes(key))
  ) {
    return false
  }

  return (
    (value.displayName === undefined
      || (typeof value.displayName === 'string'
        && value.displayName.trim().length > 0))
    && (value.appearance === undefined
      || value.appearance === 'light'
      || value.appearance === 'dark'
      || value.appearance === 'system')
    && (value.notificationsEnabled === undefined
      || typeof value.notificationsEnabled === 'boolean')
    && (value.mobileNavigation === undefined
      || isMobileNavigation(value.mobileNavigation))
    && (value.suppressUnpricedPurchaseWarning === undefined
      || typeof value.suppressUnpricedPurchaseWarning === 'boolean')
  )
}

function isOperationPayload(
  type: OperationType,
  payload: Record<string, unknown>,
): boolean {
  switch (type) {
    case 'grocery.item.upsert':
      return isGroceryItemUpsertPayload(payload)
    case 'settings.update':
      return isSettingsUpdatePayload(payload)
    case 'notification.delete':
    case 'notification.clear':
      return Object.keys(payload).length === 0
    default:
      return true
  }
}

function isNullableSafeCents(
  value: unknown,
  allowZero: boolean,
): value is Cents | null {
  return value === null
    || (typeof value === 'number'
      && Number.isSafeInteger(value)
      && value >= (allowZero ? 0 : 1))
}

function isSignedInt32(value: unknown): boolean {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= -2147483648
    && value <= 2147483647
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
