import {
  calculateUnitPriceCents,
  normalizeItemName,
  type PriceHistoryEntry,
} from './data'

/**
 * Household-wide purchase history: what the Purchase history page shows once
 * the raw rows are in hand. Every row here is an immutable snapshot the server
 * wrote at purchase time, so it keeps rendering after its grocery item and its
 * list are deleted — which is exactly why these helpers never dereference a
 * live item or list and always fall back to the snapshot's own text.
 */

/** How far back an item's detail view looks. The list itself is unbounded. */
export const PURCHASE_HISTORY_WINDOW_DAYS = 365

const WINDOW_MS = PURCHASE_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000

export interface PurchasedItemSummary {
  /** Aggregation key: the server's normalization of the item name. */
  normalizedName: string
  /** Never blank — see `purchasedItemDisplayName`. */
  displayName: string
  lastPurchasedAt: string
  /** Exact ratio; callers round only when formatting. */
  latestUnitPriceCents: number
}

/**
 * The bucket a purchase aggregates into. Prefers the stored normalized name
 * the server recorded under, and re-normalizes rather than trusting it blindly
 * so a legacy or hand-written row can never split one item into two rows.
 */
export function purchaseGroupKey(entry: PriceHistoryEntry): string {
  return normalizeItemName(entry.itemNameNormalized) || normalizeItemName(entry.itemName)
}

/** A name to show for a purchase whose source item may no longer exist. */
export function purchasedItemDisplayName(entry: PriceHistoryEntry): string {
  return entry.itemName.trim() || entry.itemNameNormalized.trim() || 'Unknown item'
}

/** The list a purchase was made on, from its snapshot — the list may be gone. */
export function purchaseStoreLabel(entry: PriceHistoryEntry): string {
  return entry.listName.trim() || 'Unknown list'
}

/**
 * One row per distinct purchased item, across every list, newest purchase
 * first. No time window: an item bought years ago stays findable.
 */
export function purchasedItemSummaries(
  history: PriceHistoryEntry[],
): PurchasedItemSummary[] {
  const newestByItem = new Map<string, PriceHistoryEntry>()
  for (const entry of history) {
    const key = purchaseGroupKey(entry)
    const existing = newestByItem.get(key)
    if (!existing || entry.recordedAt > existing.recordedAt) {
      newestByItem.set(key, entry)
    }
  }

  return [...newestByItem.entries()]
    .map(([normalizedName, entry]) => ({
      normalizedName,
      displayName: purchasedItemDisplayName(entry),
      lastPurchasedAt: entry.recordedAt,
      latestUnitPriceCents: calculateUnitPriceCents(
        entry.totalPriceCents,
        entry.purchaseQuantity,
      ),
    }))
    .sort(
      (left, right) =>
        right.lastPurchasedAt.localeCompare(left.lastPurchasedAt) ||
        left.displayName.localeCompare(right.displayName, undefined, {
          sensitivity: 'base',
        }),
    )
}

/**
 * Search key: the server's normalization with combining marks stripped, so
 * "creme" finds "Crème" and "FRAÎCHE" finds "fraiche". Applied identically to
 * the query and to the candidate, so matching stays symmetric.
 */
function searchKey(value: string): string {
  return normalizeItemName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Filters the item list by name. Blank search means no filter. */
export function filterPurchasedItems(
  items: PurchasedItemSummary[],
  search: string,
): PurchasedItemSummary[] {
  const needle = searchKey(search)
  if (needle.length === 0) return items
  return items.filter(
    (item) =>
      searchKey(item.displayName).includes(needle) ||
      searchKey(item.normalizedName).includes(needle),
  )
}

/**
 * One item's purchase occurrences inside the trailing window, newest first.
 * The window boundary is inclusive: a purchase exactly 365 days old still
 * counts.
 */
export function recentPurchasesForItem(
  history: PriceHistoryEntry[],
  normalizedName: string,
  now: Date = new Date(),
): PriceHistoryEntry[] {
  const key = normalizeItemName(normalizedName)
  const cutoff = now.getTime() - WINDOW_MS
  return history
    .filter((entry) => purchaseGroupKey(entry) === key)
    .filter((entry) => {
      const recordedAt = Date.parse(entry.recordedAt)
      return Number.isFinite(recordedAt) && recordedAt >= cutoff
    })
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
}
