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

interface CachedMonthRow {
  id: string
  month: number
}

interface CachedMonthCategory {
  id: string
  categoryId: string
  monthId: string
  name: string
  kind: 'income' | 'spending'
  sortOrder: number
  revision: number
}

interface CachedMonthLimit {
  categoryId: string
  monthId: string
  amountCents: number | null
  limitEntityId: string
  revision: number
}

interface CachedLedgerTransaction {
  id: string
  monthId: string
  categoryId: string
  assetId: string
  kind: 'income' | 'spending'
  amountCents: number
  occurredAt: string
  description: string
  revision: number
}

interface CachedLedgerYearData {
  months: CachedMonthRow[]
  categories: CachedMonthCategory[]
  limits: CachedMonthLimit[]
  transactions: CachedLedgerTransaction[]
}

interface CachedAsset {
  id: string
  balanceCents: number
  [key: string]: unknown
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
    operation.command.type === 'grocery.item.upsert'
    || operation.command.type === 'grocery.item.delete'
  ) {
    projectGroceryItem(client, operation)
    return
  }

  if (operation.command.type === 'trip.upsert') {
    projectTripUpsert(client, operation)
    return
  }

  if (
    operation.command.type === 'ledger.category.upsert'
    || operation.command.type === 'ledger.category.delete'
    || operation.command.type === 'ledger.limit.upsert'
    || operation.command.type === 'ledger.transaction.upsert'
    || operation.command.type === 'ledger.transaction.delete'
  ) {
    projectLedgerOperation(client, operation)
  }
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

interface CachedTripData {
  trip: { id: string; [key: string]: unknown } | null
  [key: string]: unknown
}

function projectTripUpsert(client: QueryClient, operation: QueuedOperation): void {
  const optimistic = operation.optimistic
  if (!optimistic) return

  const tripKey = queryKeys.trips.trip(operation.householdId, operation.entityId)
  client.setQueryData<CachedTripData>(tripKey, (current) => {
    if (!current?.trip) return current
    return { ...current, trip: { ...current.trip, ...optimistic } }
  })

  const listKey = queryKeys.trips.list(operation.householdId)
  client.setQueryData<Array<{ id: string; [key: string]: unknown }>>(listKey, (current) => {
    if (!Array.isArray(current)) return current
    return current.map((trip) =>
      trip.id === operation.entityId ? { ...trip, ...optimistic } : trip,
    )
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

function projectLedgerOperation(
  client: QueryClient,
  operation: QueuedOperation,
): void {
  const type = operation.command.type
  const optimistic = operation.optimistic
  const payload = operation.command.payload as Record<string, unknown>
  const yearId = stringValue(optimistic?.yearId) ?? stringValue(payload.yearId)

  if (!yearId) return

  const fromMonth = numberValue(optimistic?.fromMonth) ?? numberValue(payload.fromMonth)
  const month = numberValue(optimistic?.month) ?? numberValue(payload.month)

  if (type === 'ledger.category.upsert' && fromMonth !== null) {
    projectCategoryUpsert(client, operation.householdId, yearId, operation.entityId, optimistic as Record<string, unknown>, fromMonth)
  } else if (type === 'ledger.category.delete' && fromMonth !== null) {
    projectCategoryDelete(client, operation.householdId, yearId, operation.entityId, fromMonth)
  } else if (type === 'ledger.limit.upsert' && optimistic && fromMonth !== null) {
    projectLimitUpsert(client, operation.householdId, yearId, optimistic as Record<string, unknown>, fromMonth)
  } else if (type === 'ledger.transaction.upsert' && optimistic && month !== null) {
    projectTransactionAssetBalance(client, operation.householdId, yearId, operation.entityId, optimistic as Record<string, unknown>)
    projectTransactionUpsert(client, operation.householdId, yearId, operation.entityId, optimistic as Record<string, unknown>, month)
  } else if (type === 'ledger.transaction.delete') {
    projectTransactionAssetBalance(client, operation.householdId, yearId, operation.entityId, null)
    projectTransactionDelete(client, operation.householdId, yearId, operation.entityId)
  }
}

function projectCategoryUpsert(
  client: QueryClient,
  householdId: string,
  yearId: string,
  categoryId: string,
  optimistic: Record<string, unknown>,
  fromMonth: number,
): void {
  const dataKey = [...queryKeys.ledger.years(householdId), yearId]
  client.setQueryData<CachedLedgerYearData | undefined>(dataKey, (current) => {
    if (!current) return current
    const name = stringValue(optimistic.name)
    const kind = stringValue(optimistic.kind) as 'income' | 'spending' | null
    const sortOrder = numberValue(optimistic.sortOrder)

    if (!name || !kind || sortOrder === null) return current

    const updated = { ...current }
    const monthIds = current.months
      .filter((m) => m.month >= fromMonth)
      .map((m) => m.id)

    if (monthIds.length === 0) return updated

    updated.categories = current.categories.filter(
      (cat) => !(cat.categoryId === categoryId && monthIds.includes(cat.monthId)),
    )

    for (const monthId of monthIds) {
      updated.categories.push({
        id: `${categoryId}:${monthId}`,
        categoryId,
        monthId,
        name,
        kind,
        sortOrder,
        revision: 1,
      } as CachedMonthCategory)
    }

    updated.categories.sort(
      (a, b) => {
        if (a.monthId !== b.monthId) return a.monthId.localeCompare(b.monthId)
        return a.sortOrder - b.sortOrder
      },
    )

    return updated
  })
}

function projectCategoryDelete(
  client: QueryClient,
  householdId: string,
  yearId: string,
  categoryId: string,
  fromMonth: number,
): void {
  const dataKey = [...queryKeys.ledger.years(householdId), yearId]
  client.setQueryData<CachedLedgerYearData | undefined>(dataKey, (current) => {
    if (!current) return current
    const monthIds = current.months
      .filter((m) => m.month >= fromMonth)
      .map((m) => m.id)

    if (monthIds.length === 0) return current

    return {
      ...current,
      categories: current.categories.filter(
        (cat) => !(cat.categoryId === categoryId && monthIds.includes(cat.monthId)),
      ),
      limits: current.limits.filter(
        (limit) => !(limit.categoryId === categoryId && monthIds.includes(limit.monthId)),
      ),
    }
  })
}

function projectLimitUpsert(
  client: QueryClient,
  householdId: string,
  yearId: string,
  optimistic: Record<string, unknown>,
  fromMonth: number,
): void {
  const dataKey = [...queryKeys.ledger.years(householdId), yearId]
  client.setQueryData<CachedLedgerYearData | undefined>(dataKey, (current) => {
    if (!current) return current
    const categoryId = stringValue(optimistic.categoryId)
    const amountCents = numberValue(optimistic.amountCents)

    if (!categoryId || amountCents === null) return current

    const monthIds = current.months
      .filter((m) => m.month >= fromMonth)
      .map((m) => m.id)
    if (monthIds.length === 0) return current

    const updated = { ...current }
    updated.limits = current.limits.filter(
      (limit) => !(limit.categoryId === categoryId && monthIds.includes(limit.monthId)),
    )
    for (const monthId of monthIds) {
      updated.limits.push({
        categoryId,
        monthId,
        amountCents,
        limitEntityId: categoryId,
        revision: 1,
      })
    }

    return updated
  })
}

function projectTransactionAssetBalance(
  client: QueryClient,
  householdId: string,
  yearId: string,
  transactionId: string,
  optimistic: Record<string, unknown> | null,
): void {
  const assetsKey = queryKeys.ledger.assets(householdId)
  const dataKey = [...queryKeys.ledger.years(householdId), yearId]
  const yearData = client.getQueryData<CachedLedgerYearData>(dataKey)
  const oldTransaction = yearData?.transactions.find((t) => t.id === transactionId)

  const adjustments = new Map<string, number>()

  if (oldTransaction) {
    const delta = oldTransaction.kind === 'income'
      ? -oldTransaction.amountCents
      : oldTransaction.amountCents
    adjustments.set(oldTransaction.assetId, (adjustments.get(oldTransaction.assetId) ?? 0) + delta)
  }

  if (optimistic) {
    const assetId = stringValue(optimistic.assetId)
    const kind = stringValue(optimistic.kind)
    const amountCents = numberValue(optimistic.amountCents)
    if (assetId && kind && amountCents !== null) {
      const delta = kind === 'income' ? amountCents : -amountCents
      adjustments.set(assetId, (adjustments.get(assetId) ?? 0) + delta)
    }
  }

  if (adjustments.size === 0) return

  client.setQueryData<CachedAsset[]>(assetsKey, (current) => {
    if (!Array.isArray(current)) return current
    return current.map((asset) => {
      const delta = adjustments.get(asset.id)
      if (delta === undefined) return asset
      return { ...asset, balanceCents: asset.balanceCents + delta }
    })
  })
}

function projectTransactionUpsert(
  client: QueryClient,
  householdId: string,
  yearId: string,
  transactionId: string,
  optimistic: Record<string, unknown>,
  month: number,
): void {
  const dataKey = [...queryKeys.ledger.years(householdId), yearId]
  client.setQueryData<CachedLedgerYearData | undefined>(dataKey, (current) => {
    if (!current) return current
    const monthRow = current.months.find((m) => m.month === month)
    if (!monthRow) return current

    const categoryId = stringValue(optimistic.categoryId)
    const assetId = stringValue(optimistic.assetId)
    const kind = stringValue(optimistic.kind) as 'income' | 'spending' | null
    const amountCents = numberValue(optimistic.amountCents)
    const occurredAt = stringValue(optimistic.occurredAt)
    const description = stringValue(optimistic.description)

    if (!categoryId || !assetId || !kind || amountCents === null || !occurredAt || !description) {
      return current
    }

    const updated = { ...current }
    updated.transactions = current.transactions.filter((t) => t.id !== transactionId)
    updated.transactions.push({
      id: transactionId,
      monthId: monthRow.id,
      categoryId,
      assetId,
      kind,
      amountCents,
      occurredAt,
      description,
      revision: 1,
    })

    return updated
  })
}

function projectTransactionDelete(
  client: QueryClient,
  householdId: string,
  yearId: string,
  transactionId: string,
): void {
  const dataKey = [...queryKeys.ledger.years(householdId), yearId]
  client.setQueryData<CachedLedgerYearData | undefined>(dataKey, (current) => {
    if (!current) return current
    return {
      ...current,
      transactions: current.transactions.filter((t) => t.id !== transactionId),
    }
  })
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

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}
