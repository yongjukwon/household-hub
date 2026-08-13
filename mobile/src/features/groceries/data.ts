import { queryKeys } from '@household-hub/domain'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { withOptimisticOverlay } from '@/lib/operations'
import type { Tables } from '@/types/database'

export interface GroceryList {
  id: string
  name: string
  sortOrder: number
  revision: number
}

export interface GroceryItem {
  id: string
  listId: string
  name: string
  quantity: string | null
  checked: boolean
  checkedAt: string | null
  unitPriceCents: number | null
  purchaseQuantity: number | null
  totalPriceCents: number | null
  purchaseOccurrenceId: string | null
  sortOrder: number
  revision: number
}

export interface PriceHistoryEntry {
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

export interface GroceryKnowledgeItem {
  name: string
}

function toList(row: Tables<'household_grocery_lists'>): GroceryList {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    revision: row.revision,
  }
}

function toItem(row: Tables<'household_grocery_items'>): GroceryItem {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    quantity: row.quantity,
    checked: row.checked,
    checkedAt: row.checked_at,
    unitPriceCents: row.unit_price_cents,
    purchaseQuantity: row.purchase_quantity,
    totalPriceCents: row.total_price_cents,
    purchaseOccurrenceId: row.purchase_occurrence_id,
    sortOrder: row.sort_order,
    revision: row.revision,
  }
}

/** All grocery lists in the household, ordered for display. */
export function useGroceryLists(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId ? queryKeys.groceries.lists(householdId) : ['groceries', 'off'],
    enabled: !!householdId,
    queryFn: async (): Promise<GroceryList[]> => {
      const { data, error } = await supabase
        .from('household_grocery_lists')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .returns<Tables<'household_grocery_lists'>[]>()
      if (error) throw error
      return withOptimisticOverlay((data ?? []).map(toList), 'grocery_list')
    },
  })
}

/** Items in a list, plus household-wide Grocery knowledge for the detail screen. */
export function useGroceryList(
  householdId: string | undefined,
  listId: string | undefined,
) {
  return useQuery({
    queryKey:
      householdId && listId
        ? queryKeys.groceries.list(householdId, listId)
        : ['groceries', 'list', 'off'],
    enabled: !!householdId && !!listId,
    queryFn: async (): Promise<{
      items: GroceryItem[]
      history: PriceHistoryEntry[]
      knowledgeItems: GroceryKnowledgeItem[]
    }> => {
      const [items, history, knowledge] = await Promise.all([
        supabase
          .from('household_grocery_items')
          .select('*')
          .eq('list_id', listId!)
          .order('checked', { ascending: true })
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .returns<Tables<'household_grocery_items'>[]>(),
        supabase
          .from('household_grocery_price_history')
          .select('*')
          .eq('household_id', householdId!)
          .order('recorded_at', { ascending: false })
          .returns<Tables<'household_grocery_price_history'>[]>(),
        supabase
          .from('household_grocery_items')
          .select('name')
          .eq('household_id', householdId!)
          .returns<GroceryKnowledgeItem[]>(),
      ])
      if (items.error) throw items.error
      if (history.error) throw history.error
      if (knowledge.error) throw knowledge.error
      const overlaidItems = await withOptimisticOverlay(
        (items.data ?? []).map(toItem),
        'grocery_item',
      )
      return {
        items: overlaidItems,
        history: (history.data ?? []).map((r) => ({
          id: r.id,
          itemNameNormalized: r.item_name_normalized,
          itemName: r.item_name,
          priceCents: r.price_cents,
          recordedAt: r.recorded_at,
          listName: r.store_name,
          purchaseQuantity: r.purchase_quantity,
          totalPriceCents: r.total_price_cents,
          sourceItemId: r.source_item_id,
          purchaseOccurrenceId: r.purchase_occurrence_id,
        })),
        knowledgeItems: [
          ...(knowledge.data ?? []),
          ...overlaidItems.map((item) => ({ name: item.name })),
        ],
      }
    },
  })
}

/** Latest recorded price per normalized item name, for quick price recall. */
export function latestPriceByName(
  history: PriceHistoryEntry[],
): Map<string, PriceHistoryEntry> {
  const latest = new Map<string, PriceHistoryEntry>()
  for (const entry of history) {
    const existing = latest.get(entry.itemNameNormalized)
    if (!existing || entry.recordedAt > existing.recordedAt) {
      latest.set(entry.itemNameNormalized, entry)
    }
  }
  return latest
}

/** Normalizes an item name the same way the server records price history. */
export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase()
}

/** Keeps active items in list order and purchases newest first. */
export function sortGroceryItems(items: GroceryItem[]): {
  unchecked: GroceryItem[]
  checked: GroceryItem[]
} {
  const unchecked = items
    .filter((item) => !item.checked)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    )
  const checked = items
    .filter((item) => item.checked)
    .sort((left, right) => {
      const byDate = (right.checkedAt ?? '').localeCompare(left.checkedAt ?? '')
      return byDate || left.sortOrder - right.sortOrder
    })
  return { unchecked, checked }
}

/** Item-scoped five-cheapest purchase history, without currency conversion. */
export function displayedPriceHistory(
  history: PriceHistoryEntry[],
  normalizedName: string,
): PriceHistoryEntry[] {
  const matching = history
    .filter((entry) => entry.itemNameNormalized === normalizedName)
    .sort(
      (left, right) =>
        left.priceCents - right.priceCents ||
        right.recordedAt.localeCompare(left.recordedAt),
    )
  if (matching.length < 6) return matching
  return [...matching.slice(0, 3), ...matching.slice(-3).reverse()]
}

export function parsePurchaseQuantity(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null
  const quantity = Number(trimmed)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null
}

/** Household-wide autocomplete names, deduped case-insensitively. */
export function groceryNameSuggestions(
  items: GroceryKnowledgeItem[],
  history: PriceHistoryEntry[],
): string[] {
  const names = new Map<string, string>()
  for (const candidate of [
    ...items.map((item) => item.name),
    ...history.map((entry) => entry.itemName),
  ]) {
    const display = candidate.trim()
    const normalized = normalizeItemName(display)
    if (normalized && !names.has(normalized)) names.set(normalized, display)
  }
  return [...names.values()].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' }),
  )
}
