import { queryKeys } from '@household-hub/domain'
import { applyOptimisticOverlay } from '@household-hub/application/operations'
import type { QueryClient, QueryKey } from '@tanstack/react-query'

import type { QueuedOperation } from './types'

interface CachedProfile {
  userId: string
  [key: string]: unknown
}

interface CachedGroceryList {
  id: string
  name: string
}

interface CachedGroceryItem {
  id: string
  listId: string
  name: string
  checked: boolean
  checkedAt: string | null
  [key: string]: unknown
}

interface CachedPriceHistoryEntry {
  id: string
  itemNameNormalized: string
  itemName: string
  priceCents: number
  recordedAt: string
  listName: string
  purchaseQuantity: number
  totalPriceCents: number
  sourceItemId: string | null
  purchaseOccurrenceId: string | null
}

interface CachedGroceryListData {
  items: CachedGroceryItem[]
  history: CachedPriceHistoryEntry[]
  knowledgeItems: { name: string }[]
}

/**
 * Applies durable native commands to already-fetched React Query data. The
 * query persister observes these writes, so an offline relaunch sees the same
 * state as the screen that enqueued them without requiring a network fetch.
 */
export function projectOperationIntoQueryCache(
  client: QueryClient,
  operation: QueuedOperation,
): void {
  if (operation.command.type === 'settings.update') {
    projectProfile(client, operation)
    return
  }

  if (
    operation.command.type !== 'grocery.item.upsert'
    && operation.command.type !== 'grocery.item.delete'
  ) {
    return
  }

  projectGroceryItem(client, operation)
}

/** Re-applies the SQLite queue after persisted-query hydration on relaunch. */
export function projectPendingOperationsIntoQueryCache(
  client: QueryClient,
  operations: QueuedOperation[],
): void {
  for (const operation of [...operations].sort(
    (left, right) => left.localSequence - right.localSequence,
  )) {
    projectOperationIntoQueryCache(client, operation)
  }
}

function projectProfile(client: QueryClient, operation: QueuedOperation): void {
  if (!operation.optimistic) return
  const key = ['profile', operation.entityId] as const
  client.setQueryData<CachedProfile | null>(key, (current) => {
    if (!current) return current
    return { ...current, ...operation.optimistic }
  })
}

function projectGroceryItem(
  client: QueryClient,
  operation: QueuedOperation,
): void {
  const detailQueries = groceryDetailQueries(client, operation.householdId)
  const existingItem = firstCachedItem(client, detailQueries, operation.entityId)
  const optimistic = operation.optimistic
  const targetListId = stringValue(optimistic?.listId)

  for (const queryKey of detailQueries) {
    const listId = stringValue(queryKey[4])
    client.setQueryData<CachedGroceryListData>(queryKey, (current) => {
      if (!current || !isGroceryListData(current)) return current

      const items = applyOptimisticOverlay(
        current.items,
        [operation],
        'grocery_item',
        {
          householdId: operation.householdId,
          repairLegacyPayloads: true,
        },
      )
        .filter((item) => item.listId === listId)
        .map((item) => {
          if (
            item.id === operation.entityId
            && existingItem?.checked
            && item.checked
          ) {
            return { ...item, checkedAt: existingItem.checkedAt }
          }
          return item
        })
      const projected = items.find((item) => item.id === operation.entityId)
      const name = targetListId === listId
        ? stringValue(projected?.name)
        : null
      const knowledgeItems = name && !current.knowledgeItems.some(
        (entry) => entry.name.trim().toLowerCase() === name.trim().toLowerCase(),
      )
        ? [...current.knowledgeItems, { name }]
        : current.knowledgeItems
      return {
        ...current,
        items,
        knowledgeItems,
      }
    })
  }

  if (operation.command.type !== 'grocery.item.upsert' || !optimistic) return
  const purchase = optimisticPurchase(
    client,
    operation,
    optimistic,
    existingItem,
  )
  if (!purchase) return

  const historyKey = queryKeys.groceries.purchaseHistory(operation.householdId)
  const cachedHistory = firstCachedHistory(client, operation.householdId)
  client.setQueryData<CachedPriceHistoryEntry[]>(historyKey, (current) =>
    upsertProjectedPurchase(
      Array.isArray(current) ? current : cachedHistory,
      purchase,
    ),
  )
  for (const queryKey of detailQueries) {
    client.setQueryData<CachedGroceryListData>(queryKey, (current) =>
      current && isGroceryListData(current)
        ? {
            ...current,
            history: upsertProjectedPurchase(current.history, purchase),
          }
        : current,
    )
  }
}

function optimisticPurchase(
  client: QueryClient,
  operation: QueuedOperation,
  optimistic: Record<string, unknown>,
  existingItem: CachedGroceryItem | undefined,
): CachedPriceHistoryEntry | null {
  if (optimistic.checked !== true) return null
  const purchaseQuantity = positiveNumber(optimistic.purchaseQuantity)
  const totalPriceCents = positiveNumber(optimistic.totalPriceCents)
  const purchaseOccurrenceId = stringValue(optimistic.purchaseOccurrenceId)
  const listId = stringValue(optimistic.listId)
  const itemName = stringValue(optimistic.name)?.trim()
  if (
    purchaseQuantity === null
    || totalPriceCents === null
    || !purchaseOccurrenceId
    || !listId
    || !itemName
  ) {
    return null
  }

  const existingOccurrence = firstCachedHistory(client, operation.householdId)
    .find((entry) => entry.purchaseOccurrenceId === purchaseOccurrenceId)
  const listName = existingOccurrence?.listName
    ?? cachedListName(client, operation.householdId, listId)
    ?? 'Unknown list'
  const recordedAt = existingItem?.checked && existingItem.checkedAt
    ? existingItem.checkedAt
    : stringValue(optimistic.checkedAt) ?? operation.enqueuedAt

  return {
    id: existingOccurrence?.id ?? operation.operationId,
    itemNameNormalized: itemName.toLowerCase(),
    itemName,
    priceCents: Math.round(totalPriceCents / purchaseQuantity),
    recordedAt,
    listName,
    purchaseQuantity,
    totalPriceCents,
    sourceItemId: operation.entityId,
    purchaseOccurrenceId,
  }
}

function upsertProjectedPurchase(
  history: CachedPriceHistoryEntry[],
  purchase: CachedPriceHistoryEntry,
): CachedPriceHistoryEntry[] {
  const occurrence = history.find(
    (entry) => entry.purchaseOccurrenceId === purchase.purchaseOccurrenceId,
  )
  const bucketListName = occurrence?.listName ?? purchase.listName
  const collision = history.find(
    (entry) =>
      entry.id !== occurrence?.id
      && entry.itemNameNormalized === purchase.itemNameNormalized
      && entry.listName === bucketListName
      && entry.totalPriceCents * purchase.purchaseQuantity
        === purchase.totalPriceCents * entry.purchaseQuantity,
  )

  if (!occurrence && collision && purchase.recordedAt < collision.recordedAt) {
    return history
  }

  const current = occurrence ?? collision
  const projected = {
    ...purchase,
    id: current?.id ?? purchase.id,
    listName: bucketListName,
  }
  return [
    projected,
    ...history.filter(
      (entry) => entry.id !== occurrence?.id && entry.id !== collision?.id,
    ),
  ].sort(
    (left, right) =>
      right.recordedAt.localeCompare(left.recordedAt)
      || right.id.localeCompare(left.id),
  )
}

function groceryDetailQueries(
  client: QueryClient,
  householdId: string,
): QueryKey[] {
  return client
    .getQueryCache()
    .findAll({ queryKey: ['household', householdId, 'groceries', 'list'] })
    .map((query) => query.queryKey)
    .filter((queryKey) => queryKey.length === 5)
}

function firstCachedItem(
  client: QueryClient,
  detailQueries: QueryKey[],
  itemId: string,
): CachedGroceryItem | undefined {
  for (const queryKey of detailQueries) {
    const data = client.getQueryData(queryKey)
    if (!isGroceryListData(data)) continue
    const item = data.items.find((entry) => entry.id === itemId)
    if (item) return item
  }
  return undefined
}

function firstCachedHistory(
  client: QueryClient,
  householdId: string,
): CachedPriceHistoryEntry[] {
  const householdHistory = client.getQueryData(
    queryKeys.groceries.purchaseHistory(householdId),
  )
  if (isPriceHistory(householdHistory)) return householdHistory
  for (const queryKey of groceryDetailQueries(client, householdId)) {
    const data = client.getQueryData(queryKey)
    if (isGroceryListData(data)) return data.history
  }
  return []
}

function cachedListName(
  client: QueryClient,
  householdId: string,
  listId: string,
): string | null {
  const lists = client.getQueryData(
    queryKeys.groceries.lists(householdId),
  )
  if (!Array.isArray(lists)) return null
  const list = (lists as CachedGroceryList[]).find((entry) => entry.id === listId)
  return stringValue(list?.name)?.trim() || null
}

function isGroceryListData(value: unknown): value is CachedGroceryListData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CachedGroceryListData>
  return Array.isArray(candidate.items)
    && Array.isArray(candidate.history)
    && Array.isArray(candidate.knowledgeItems)
}

function isPriceHistory(value: unknown): value is CachedPriceHistoryEntry[] {
  return Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}
