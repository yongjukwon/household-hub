import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'

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

function invalidateGroceries(
  queryClient: ReturnType<typeof useQueryClient>,
  pageId: string,
) {
  queryClient.invalidateQueries({ queryKey: groceryKeys.items(pageId) })
  // Price writes append history rows via a database trigger, so any item
  // mutation may have changed history for this page.
  queryClient.invalidateQueries({ queryKey: groceryKeys.history(pageId) })
}

export function useCreateGroceryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateGroceryItemInput): Promise<GroceryItem> => {
      const row: Omit<
        TablesInsert<'grocery_items'>,
        'household_id' | 'name_normalized'
      > = {
        id: input.id,
        page_id: input.pageId,
        name: input.name,
        sort_order: input.sortOrder,
      }
      // household_id is trigger-derived and name_normalized is a generated
      // column; the codegen Insert type cannot express either.
      const { data, error } = await supabase
        .from('grocery_items')
        .upsert(row as unknown as TablesInsert<'grocery_items'>, {
          onConflict: 'id',
        })
        .select()
        .single()

      if (error) throw error
      return normalizeItem(data)
    },
    onSuccess: (_data, input) => {
      invalidateGroceries(queryClient, input.pageId)
    },
  })
}

export function useUpdateGroceryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateGroceryItemInput): Promise<GroceryItem> => {
      const updates: TablesUpdate<'grocery_items'> = {}
      if (input.name !== undefined) updates.name = input.name
      if (input.checked !== undefined) updates.checked = input.checked
      if (input.lastPrice !== undefined) updates.last_price = input.lastPrice
      const { data, error } = await supabase
        .from('grocery_items')
        .update(updates)
        .eq('id', input.id)
        .eq('page_id', input.pageId)
        .select()
        .single()

      if (error) throw error
      return normalizeItem(data)
    },
    onSuccess: (_data, input) => {
      invalidateGroceries(queryClient, input.pageId)
    },
  })
}

export function useDeleteGroceryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeleteGroceryItemInput): Promise<void> => {
      const { error } = await supabase
        .from('grocery_items')
        .delete()
        .eq('id', input.id)
        .eq('page_id', input.pageId)

      if (error) throw error
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: groceryKeys.items(input.pageId) })
    },
  })
}

/** Deletes checked items only; price history is untouched by design. */
export function useClearCheckedGroceryItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (pageId: string): Promise<void> => {
      const { error } = await supabase
        .from('grocery_items')
        .delete()
        .eq('page_id', pageId)
        .eq('checked', true)

      if (error) throw error
    },
    onSuccess: (_data, pageId) => {
      queryClient.invalidateQueries({ queryKey: groceryKeys.items(pageId) })
    },
  })
}
