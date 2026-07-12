import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queueWrite } from '@/lib/offline/outbox'
import type { Tables, TablesUpdate } from '@/types/database'

export type GroceryItem = Tables<'grocery_items'>
export type GroceryPriceRecord = Tables<'grocery_price_history'>
/** A price record with the store (page title) it was recorded at. */
export interface GroceryPriceRecordWithStore extends GroceryPriceRecord {
  store: string | null
}

export const groceryKeys = {
  all: ['grocery'] as const,
  page: (pageId: string) => ['grocery', pageId] as const,
  items: (pageId: string) => ['grocery', pageId, 'items'] as const,
  // Price history and name suggestions are household-wide (across every
  // grocery page), so their keys are not scoped to a page.
  history: () => ['grocery', 'history'] as const,
  itemHistory: (nameNormalized: string) =>
    ['grocery', 'history', nameNormalized] as const,
  names: () => ['grocery', 'names'] as const,
}

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase()
}

function normalizeItem(row: GroceryItem): GroceryItem {
  return {
    ...row,
    last_price: row.last_price === null ? null : Number(row.last_price),
  }
}

export function useGroceryItems(pageId: string) {
  return useQuery({
    queryKey: groceryKeys.items(pageId),
    enabled: !!pageId,
    queryFn: async (): Promise<GroceryItem[]> => {
      // Newest-first: the most recently added item appears at the top of the
      // list. (sort_order is still stored but no longer drives display — there
      // is no manual reordering UI.)
      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .eq('page_id', pageId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })

      if (error) throw error
      return (data ?? []).map(normalizeItem)
    },
  })
}

/**
 * Household-wide recorded prices for one normalized item name, newest first,
 * each labeled with the store (page title) it was recorded at. Drives both the
 * "last seen $X" hint (first row) and the history popover, so an item's prices
 * are visible across every store — not just the current page. RLS scopes the
 * query to the household; history survives item deletion (keyed by name).
 */
export function useGroceryPriceHistory(
  nameNormalized: string,
  { limit = 5 }: { limit?: number } = {},
) {
  return useQuery({
    queryKey: groceryKeys.itemHistory(nameNormalized),
    enabled: nameNormalized.length > 0,
    queryFn: async (): Promise<GroceryPriceRecordWithStore[]> => {
      const { data, error } = await supabase
        .from('grocery_price_history')
        .select('*, pages(title)')
        .eq('item_name_normalized', nameNormalized)
        .order('recorded_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit)

      if (error) throw error
      return (data ?? []).map((row) => {
        const { pages, ...record } = row as GroceryPriceRecord & {
          pages: { title: string } | null
        }
        return {
          ...record,
          price: Number(record.price),
          store: pages?.title ?? null,
        }
      })
    },
  })
}

/**
 * Distinct grocery item names known across the whole household — current items
 * on any page plus names in price history — for the add-field autocomplete.
 * Deduped by normalized name, preferring a current item's display casing.
 */
export function useGroceryNameSuggestions() {
  return useQuery({
    queryKey: groceryKeys.names(),
    queryFn: async (): Promise<string[]> => {
      const [items, history] = await Promise.all([
        supabase.from('grocery_items').select('name, name_normalized'),
        supabase
          .from('grocery_price_history')
          .select('item_name, item_name_normalized'),
      ])
      if (items.error) throw items.error
      if (history.error) throw history.error

      const byNormalized = new Map<string, string>()
      for (const row of items.data ?? []) {
        if (row.name_normalized) byNormalized.set(row.name_normalized, row.name)
      }
      for (const row of history.data ?? []) {
        const normalized = row.item_name_normalized
        if (!normalized || byNormalized.has(normalized)) continue
        byNormalized.set(normalized, row.item_name ?? normalized)
      }
      return [...byNormalized.values()].sort((a, b) => a.localeCompare(b))
    },
  })
}

export interface CreateGroceryItemInput {
  id: string
  pageId: string
  name: string
  sortOrder: number
  /** Optional price set at add time; recorded to price history by the DB
   * trigger just like editing a price later. */
  lastPrice?: number | null
}

export interface UpdateGroceryItemInput {
  id: string
  pageId: string
  name?: string
  checked?: boolean
  lastPrice?: number | null
}

export interface DeleteGroceryItemInput {
  id: string
  pageId: string
}

export interface ClearCheckedInput {
  pageId: string
  /** The currently-checked item ids — queued as row-scoped deletes so a
   * later replay can never remove items checked after the clear. */
  ids: string[]
}

function invalidateGroceries(
  queryClient: ReturnType<typeof useQueryClient>,
  pageId: string,
) {
  queryClient.invalidateQueries({ queryKey: groceryKeys.items(pageId) })
  // Price writes append history rows via a database trigger (household-wide),
  // and a new/renamed item changes the name-suggestion set.
  queryClient.invalidateQueries({ queryKey: groceryKeys.history() })
  queryClient.invalidateQueries({ queryKey: groceryKeys.names() })
}

// Grocery writes are offline-capable (offline-mutation-outbox pattern): the
// cache is patched optimistically with the row's final client-generated id,
// the write is queued durably BEFORE any network attempt, and 'queued'
// resolves as success. When a queued write later syncs, the resulting
// realtime event refreshes the cache with server truth; 'synced' writes
// invalidate immediately.

export function useCreateGroceryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: CreateGroceryItemInput,
    ): Promise<'synced' | 'queued'> => {
      const now = new Date().toISOString()
      const lastPrice = input.lastPrice ?? null
      // Optimistic row: household_id is trigger-derived server-side and never
      // rendered, so a placeholder is fine until server truth arrives.
      const optimistic: GroceryItem = {
        id: input.id,
        household_id: '',
        page_id: input.pageId,
        name: input.name,
        name_normalized: normalizeItemName(input.name),
        checked: false,
        last_price: lastPrice,
        sort_order: input.sortOrder,
        created_at: now,
        updated_at: now,
      }
      // Prepend so a newly added item lands at the top (matches the
      // newest-first list order).
      queryClient.setQueryData<GroceryItem[]>(
        groceryKeys.items(input.pageId),
        (old = []) => [optimistic, ...old],
      )
      return queueWrite({
        clientId: input.id,
        table: 'grocery_items',
        op: 'upsert',
        payload: {
          id: input.id,
          page_id: input.pageId,
          name: input.name,
          sort_order: input.sortOrder,
          // Included only when a price was entered at add time; the INSERT
          // then fires the price-history trigger.
          ...(lastPrice !== null ? { last_price: lastPrice } : {}),
        },
        match: { id: input.id },
      })
    },
    onSuccess: (status, input) => {
      if (status === 'synced') invalidateGroceries(queryClient, input.pageId)
    },
  })
}

export function useUpdateGroceryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: UpdateGroceryItemInput,
    ): Promise<'synced' | 'queued'> => {
      const updates: TablesUpdate<'grocery_items'> = {}
      if (input.name !== undefined) updates.name = input.name
      if (input.checked !== undefined) updates.checked = input.checked
      if (input.lastPrice !== undefined) updates.last_price = input.lastPrice
      queryClient.setQueryData<GroceryItem[]>(
        groceryKeys.items(input.pageId),
        (old = []) =>
          old.map((item) =>
            item.id === input.id
              ? {
                  ...item,
                  ...updates,
                  name_normalized:
                    input.name !== undefined
                      ? normalizeItemName(input.name)
                      : item.name_normalized,
                }
              : item,
          ),
      )
      return queueWrite({
        clientId: input.id,
        table: 'grocery_items',
        op: 'update',
        payload: updates,
        match: { id: input.id, page_id: input.pageId },
      })
    },
    onSuccess: (status, input) => {
      if (status === 'synced') invalidateGroceries(queryClient, input.pageId)
    },
  })
}

export function useDeleteGroceryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: DeleteGroceryItemInput,
    ): Promise<'synced' | 'queued'> => {
      queryClient.setQueryData<GroceryItem[]>(
        groceryKeys.items(input.pageId),
        (old = []) => old.filter((item) => item.id !== input.id),
      )
      return queueWrite({
        clientId: input.id,
        table: 'grocery_items',
        op: 'delete',
        payload: {},
        match: { id: input.id, page_id: input.pageId },
      })
    },
    onSuccess: (status, input) => {
      if (status === 'synced') {
        queryClient.invalidateQueries({
          queryKey: groceryKeys.items(input.pageId),
        })
        queryClient.invalidateQueries({ queryKey: groceryKeys.names() })
      }
    },
  })
}

/** Deletes the given (checked) items only; price history is untouched. */
export function useClearCheckedGroceryItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: ClearCheckedInput,
    ): Promise<'synced' | 'queued'> => {
      const cleared = new Set(input.ids)
      queryClient.setQueryData<GroceryItem[]>(
        groceryKeys.items(input.pageId),
        (old = []) => old.filter((item) => !cleared.has(item.id)),
      )
      let status: 'synced' | 'queued' = 'synced'
      for (const id of input.ids) {
        const result = await queueWrite({
          clientId: id,
          table: 'grocery_items',
          op: 'delete',
          payload: {},
          match: { id, page_id: input.pageId },
        })
        if (result === 'queued') status = 'queued'
      }
      return status
    },
    onSuccess: (status, input) => {
      if (status === 'synced') {
        queryClient.invalidateQueries({
          queryKey: groceryKeys.items(input.pageId),
        })
        queryClient.invalidateQueries({ queryKey: groceryKeys.names() })
      }
    },
  })
}
