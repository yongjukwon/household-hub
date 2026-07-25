import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@household-hub/domain'
import { supabase } from '@/lib/supabase'
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
  unitPriceCents: number | null
  sortOrder: number
  revision: number
}

export interface PriceHistoryEntry {
  id: string
  itemNameNormalized: string
  itemName: string
  priceCents: number
  recordedAt: string
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
    unitPriceCents: row.unit_price_cents,
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
      return (data ?? []).map(toList)
    },
  })
}

/** Items in a list, plus its price history, for the detail screen. */
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
    }> => {
      const [items, history] = await Promise.all([
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
          .eq('list_id', listId!)
          .order('recorded_at', { ascending: false })
          .returns<Tables<'household_grocery_price_history'>[]>(),
      ])
      if (items.error) throw items.error
      if (history.error) throw history.error
      return {
        items: (items.data ?? []).map(toItem),
        history: (history.data ?? []).map((r) => ({
          id: r.id,
          itemNameNormalized: r.item_name_normalized,
          itemName: r.item_name,
          priceCents: r.price_cents,
          recordedAt: r.recorded_at,
        })),
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
