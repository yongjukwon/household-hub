import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queueWrite } from '@/lib/offline/outbox'
import type { Tables, TablesUpdate } from '@/types/database'

export type GroceryItem = Tables<'grocery_items'>
export type GroceryPriceRecord = Tables<'grocery_price_history'>

export const groceryKeys = {
  all: ['grocery'] as const,
  page: (pageId: string) => ['grocery', pageId] as const,
  items: (pageId: string) => ['grocery', pageId, 'items'] as const,
  history: (pageId: string) => ['grocery', pageId, 'history'] as const,
  itemHistory: (pageId: string, nameNormalized: string) =>
    ['grocery', pageId, 'history', nameNormalized] as const,
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

function normalizeRecord(row: GroceryPriceRecord): GroceryPriceRecord {
  return { ...row, price: Number(row.price) }
}

export function useGroceryItems(pageId: string) {
  return useQuery({
    queryKey: groceryKeys.items(pageId),
    enabled: !!pageId,
    queryFn: async (): Promise<GroceryItem[]> => {
      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .eq('page_id', pageId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (error) throw error
      return (data ?? []).map(normalizeItem)
    },
  })
}

/**
 * Last recorded prices for one normalized item name, newest first. Drives
 * both the "last seen $X" hint (first row) and the history popover. History
 * survives item deletion by design — it's keyed by name, not item id.
 */
export function useGroceryPriceHistory(
  pageId: string,
  nameNormalized: string,
  { limit = 5 }: { limit?: number } = {},
) {
  return useQuery({
    queryKey: groceryKeys.itemHistory(pageId, nameNormalized),
    enabled: !!pageId && nameNormalized.length > 0,
    queryFn: async (): Promise<GroceryPriceRecord[]> => {
      const { data, error } = await supabase
        .from('grocery_price_history')
        .select('*')
        .eq('page_id', pageId)
        .eq('item_name_normalized', nameNormalized)
        .order('recorded_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit)

      if (error) throw error
      return (data ?? []).map(normalizeRecord)
    },
  })
}

export interface CreateGroceryItemInput {
  id: string
  pageId: string
  name: string
  sortOrder: number
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
  // Price writes append history rows via a database trigger, so any item
  // mutation may have changed history for this page.
  queryClient.invalidateQueries({ queryKey: groceryKeys.history(pageId) })
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
      // Optimistic row: household_id is trigger-derived server-side and never
      // rendered, so a placeholder is fine until server truth arrives.
      const optimistic: GroceryItem = {
        id: input.id,
        household_id: '',
        page_id: input.pageId,
        name: input.name,
        name_normalized: normalizeItemName(input.name),
        checked: false,
        last_price: null,
        sort_order: input.sortOrder,
        created_at: now,
        updated_at: now,
      }
      queryClient.setQueryData<GroceryItem[]>(
        groceryKeys.items(input.pageId),
        (old = []) => [...old, optimistic],
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
      }
    },
  })
}
