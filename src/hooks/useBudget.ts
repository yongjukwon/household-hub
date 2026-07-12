import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'

export type BudgetCategory = Tables<'budget_categories'>
export type BudgetEntry = Tables<'budget_entries'>
export type BudgetCategoryLimit = Tables<'budget_category_limits'>

export const budgetKeys = {
  all: ['budget'] as const,
  page: (pageId: string) => ['budget', pageId] as const,
  categories: (pageId: string) => ['budget', pageId, 'categories'] as const,
  entries: (pageId: string) => ['budget', pageId, 'entries'] as const,
  monthEntries: (pageId: string, month: string) =>
    ['budget', pageId, 'entries', month] as const,
  limits: (pageId: string) => ['budget', pageId, 'limits'] as const,
}

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

export function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonthKey(month: string, offset: number): string {
  const [year, monthNumber] = parseMonthKey(month)
  const absoluteMonth = year * 12 + monthNumber - 1 + offset
  const nextYear = Math.floor(absoluteMonth / 12)
  const nextMonth = ((absoluteMonth % 12) + 12) % 12
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`
}

export function monthBounds(month: string): { start: string; end: string } {
  parseMonthKey(month)
  return { start: `${month}-01`, end: `${shiftMonthKey(month, 1)}-01` }
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = parseMonthKey(month)
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthNumber - 1, 1))
}

export function moneyToCents(value: number | string): number {
  const amount = Number(value)
  if (!Number.isFinite(amount)) throw new Error('Invalid currency value.')
  return Math.round(amount * 100)
}

export function centsToAmount(cents: number): number {
  return cents / 100
}

function parseMonthKey(month: string): [number, number] {
  const match = MONTH_KEY_PATTERN.exec(month)
  if (!match) throw new Error(`Invalid month key: ${month}`)
  return [Number(match[1]), Number(match[2])]
}

function normalizeCategory(row: BudgetCategory): BudgetCategory {
  return { ...row, monthly_limit: Number(row.monthly_limit) }
}

function normalizeEntry(row: BudgetEntry): BudgetEntry {
  return { ...row, amount: Number(row.amount) }
}

function normalizeLimit(row: BudgetCategoryLimit): BudgetCategoryLimit {
  return { ...row, amount: Number(row.amount) }
}

/**
 * The limit in effect for a category in a given month: the amount of the most
 * recent override at-or-before that month (carry-forward until changed). With
 * no such override, falls back to the category's baseline monthly_limit — so a
 * category that never sets a per-month limit behaves exactly as before.
 */
export function effectiveLimit(
  category: BudgetCategory,
  limits: BudgetCategoryLimit[],
  month: string,
): number {
  let best: BudgetCategoryLimit | null = null
  for (const limit of limits) {
    if (limit.category_id !== category.id) continue
    if (limit.month > month) continue
    if (!best || limit.month > best.month) best = limit
  }
  return best ? Number(best.amount) : Number(category.monthly_limit)
}

export function useBudgetCategories(pageId: string) {
  return useQuery({
    queryKey: budgetKeys.categories(pageId),
    enabled: !!pageId,
    queryFn: async (): Promise<BudgetCategory[]> => {
      const { data, error } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('page_id', pageId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (error) throw error
      return (data ?? []).map(normalizeCategory)
    },
  })
}

export function useBudgetEntries(pageId: string, month: string) {
  return useQuery({
    queryKey: budgetKeys.monthEntries(pageId, month),
    enabled: !!pageId && MONTH_KEY_PATTERN.test(month),
    queryFn: async (): Promise<BudgetEntry[]> => {
      const { start, end } = monthBounds(month)
      const { data, error } = await supabase
        .from('budget_entries')
        .select('*')
        .eq('page_id', pageId)
        .gte('entry_date', start)
        .lt('entry_date', end)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })

      if (error) throw error
      return (data ?? []).map(normalizeEntry)
    },
  })
}

export function useBudgetCategoryLimits(pageId: string) {
  return useQuery({
    queryKey: budgetKeys.limits(pageId),
    enabled: !!pageId,
    queryFn: async (): Promise<BudgetCategoryLimit[]> => {
      const { data, error } = await supabase
        .from('budget_category_limits')
        .select('*')
        .eq('page_id', pageId)
        .order('month', { ascending: true })

      if (error) throw error
      return (data ?? []).map(normalizeLimit)
    },
  })
}

export interface SetBudgetCategoryLimitInput {
  id: string
  pageId: string
  categoryId: string
  month: string
  amount: number
}

/**
 * Sets (upserts) a category's limit for one month. Upsert keys on
 * (category_id, month) so re-setting the same month updates in place and a
 * retry is idempotent; the client-provided id only matters for a first insert.
 */
export function useSetBudgetCategoryLimit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: SetBudgetCategoryLimitInput,
    ): Promise<BudgetCategoryLimit> => {
      const row: Omit<TablesInsert<'budget_category_limits'>, 'household_id'> = {
        id: input.id,
        page_id: input.pageId,
        category_id: input.categoryId,
        month: input.month,
        amount: input.amount,
      }
      const { data, error } = await supabase
        .from('budget_category_limits')
        .upsert(row as unknown as TablesInsert<'budget_category_limits'>, {
          onConflict: 'category_id,month',
        })
        .select()
        .single()

      if (error) throw error
      return normalizeLimit(data)
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: budgetKeys.limits(input.pageId),
      })
    },
  })
}

export interface CreateBudgetCategoryInput {
  id: string
  pageId: string
  name: string
  monthlyLimit: number
  sortOrder: number
}

export type UpdateBudgetCategoryInput = CreateBudgetCategoryInput

export interface DeleteBudgetCategoryInput {
  id: string
  pageId: string
}

export function useCreateBudgetCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: CreateBudgetCategoryInput,
    ): Promise<BudgetCategory> => {
      const row: Omit<TablesInsert<'budget_categories'>, 'household_id'> = {
        id: input.id,
        page_id: input.pageId,
        name: input.name,
        monthly_limit: input.monthlyLimit,
        sort_order: input.sortOrder,
      }
      // household_id is always overwritten by the database trigger. The
      // generated Insert type cannot express trigger-populated columns.
      const { data, error } = await supabase
        .from('budget_categories')
        .upsert(row as unknown as TablesInsert<'budget_categories'>, {
          onConflict: 'id',
        })
        .select()
        .single()

      if (error) throw error
      return normalizeCategory(data)
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: budgetKeys.categories(input.pageId),
      })
    },
  })
}

export function useUpdateBudgetCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: UpdateBudgetCategoryInput,
    ): Promise<BudgetCategory> => {
      const updates: TablesUpdate<'budget_categories'> = {
        name: input.name,
        monthly_limit: input.monthlyLimit,
        sort_order: input.sortOrder,
      }
      const { data, error } = await supabase
        .from('budget_categories')
        .update(updates)
        .eq('id', input.id)
        .eq('page_id', input.pageId)
        .select()
        .single()

      if (error) throw error
      return normalizeCategory(data)
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: budgetKeys.categories(input.pageId),
      })
    },
  })
}

export function useDeleteBudgetCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeleteBudgetCategoryInput): Promise<void> => {
      const { error } = await supabase
        .from('budget_categories')
        .delete()
        .eq('id', input.id)
        .eq('page_id', input.pageId)

      if (error) throw error
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: budgetKeys.categories(input.pageId),
      })
      queryClient.invalidateQueries({
        queryKey: budgetKeys.entries(input.pageId),
      })
      // Deleting a category cascades its per-month limit rows.
      queryClient.invalidateQueries({
        queryKey: budgetKeys.limits(input.pageId),
      })
    },
  })
}

export interface CreateBudgetEntryInput {
  id: string
  pageId: string
  categoryId: string
  amount: number
  description: string | null
  entryDate: string
}

export type UpdateBudgetEntryInput = CreateBudgetEntryInput

export interface DeleteBudgetEntryInput {
  id: string
  pageId: string
}

export function useCreateBudgetEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateBudgetEntryInput): Promise<BudgetEntry> => {
      const row: Omit<
        TablesInsert<'budget_entries'>,
        'household_id' | 'created_by'
      > = {
        id: input.id,
        page_id: input.pageId,
        category_id: input.categoryId,
        amount: input.amount,
        description: input.description,
        entry_date: input.entryDate,
      }
      // household_id and created_by are server-derived. Keep the client row
      // complete and replayable while narrowing the unavoidable codegen cast.
      const { data, error } = await supabase
        .from('budget_entries')
        .upsert(row as unknown as TablesInsert<'budget_entries'>, {
          onConflict: 'id',
        })
        .select()
        .single()

      if (error) throw error
      return normalizeEntry(data)
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: budgetKeys.entries(input.pageId),
      })
    },
  })
}

export function useUpdateBudgetEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateBudgetEntryInput): Promise<BudgetEntry> => {
      const updates: TablesUpdate<'budget_entries'> = {
        category_id: input.categoryId,
        amount: input.amount,
        description: input.description,
        entry_date: input.entryDate,
      }
      const { data, error } = await supabase
        .from('budget_entries')
        .update(updates)
        .eq('id', input.id)
        .eq('page_id', input.pageId)
        .select()
        .single()

      if (error) throw error
      return normalizeEntry(data)
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: budgetKeys.entries(input.pageId),
      })
    },
  })
}

export function useDeleteBudgetEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeleteBudgetEntryInput): Promise<void> => {
      const { error } = await supabase
        .from('budget_entries')
        .delete()
        .eq('id', input.id)
        .eq('page_id', input.pageId)

      if (error) throw error
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: budgetKeys.entries(input.pageId),
      })
    },
  })
}
