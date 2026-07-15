import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'

export type SavingsSource = Tables<'savings_sources'>
export type SavingsTransaction = Tables<'savings_transactions'>
export type SavingsDepositRule = Tables<'savings_deposit_rules'>
export type SavingsTransactionType = SavingsTransaction['type']

export const savingsKeys = {
  all: ['savings'] as const,
  sources: () => ['savings', 'sources'] as const,
  transactions: (sourceId: string) =>
    ['savings', 'transactions', sourceId] as const,
  rules: (sourceId: string) => ['savings', 'rules', sourceId] as const,
  allRules: () => ['savings', 'rules'] as const,
}

function normalizeSource(row: SavingsSource): SavingsSource {
  return { ...row, amount: Number(row.amount) }
}

function normalizeTransaction(row: SavingsTransaction): SavingsTransaction {
  return { ...row, amount: Number(row.amount) }
}

function normalizeRule(row: SavingsDepositRule): SavingsDepositRule {
  return { ...row, amount: Number(row.amount) }
}

/**
 * Semi-monthly occurrence dates for an auto-deposit rule: for every month, the
 * rule's two days-of-month (each clamped to the month's actual length — day 31
 * becomes day 30 in a 30-day month, day 29 becomes Feb 28 in a non-leap year),
 * returning every occurrence in (after, today] and never earlier than the
 * rule's start_date. `after` is the last generated date (exclusive) or null
 * for a rule that has never generated.
 */
export function semiMonthlyOccurrences(
  rule: Pick<
    SavingsDepositRule,
    'day_of_month_1' | 'day_of_month_2' | 'start_date' | 'last_generated_date'
  >,
  today: string,
): string[] {
  const floor =
    rule.last_generated_date && rule.last_generated_date > rule.start_date
      ? rule.last_generated_date
      : // start_date itself is a valid first occurrence day, so the exclusive
        // floor sits just before it.
        dayBefore(rule.start_date)
  if (floor >= today) return []

  const pad = (n: number) => String(n).padStart(2, '0')
  const [startYear, startMonth] = floor.split('-').map(Number)
  const [endYear, endMonth] = today.split('-').map(Number)
  const days = [rule.day_of_month_1, rule.day_of_month_2].sort((a, b) => a - b)

  const occurrences: string[] = []
  let year = startYear
  let month = startMonth
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const daysInMonth = new Date(year, month, 0).getDate()
    for (const day of days) {
      const clamped = Math.min(day, daysInMonth)
      const date = `${year}-${pad(month)}-${pad(clamped)}`
      if (date > floor && date <= today && date >= rule.start_date) {
        occurrences.push(date)
      }
    }
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  // Clamping can map both configured days onto the same date (e.g. 30 & 31 in
  // February) — collapse duplicates so one occurrence is logged, not two.
  return [...new Set(occurrences)]
}

function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const previous = new Date(y, m - 1, d - 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${previous.getFullYear()}-${pad(previous.getMonth() + 1)}-${pad(previous.getDate())}`
}

export function todayKey(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function useSavingsSources() {
  return useQuery({
    queryKey: savingsKeys.sources(),
    queryFn: async (): Promise<SavingsSource[]> => {
      const { data, error } = await supabase
        .from('savings_sources')
        .select('*')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (error) throw error
      return (data ?? []).map(normalizeSource)
    },
  })
}

export function useSavingsTransactions(sourceId: string) {
  return useQuery({
    queryKey: savingsKeys.transactions(sourceId),
    enabled: !!sourceId,
    queryFn: async (): Promise<SavingsTransaction[]> => {
      const { data, error } = await supabase
        .from('savings_transactions')
        .select('*')
        .eq('source_id', sourceId)
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })

      if (error) throw error
      return (data ?? []).map(normalizeTransaction)
    },
  })
}

export function useSavingsDepositRules(sourceId: string) {
  return useQuery({
    queryKey: savingsKeys.rules(sourceId),
    enabled: !!sourceId,
    queryFn: async (): Promise<SavingsDepositRule[]> => {
      const { data, error } = await supabase
        .from('savings_deposit_rules')
        .select('*')
        .eq('source_id', sourceId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []).map(normalizeRule)
    },
  })
}

export interface CreateSavingsSourceInput {
  id: string
  householdId: string
  name: string
  /** Baseline balance; not logged as a transaction. */
  startingAmount: number
}

export function useCreateSavingsSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: CreateSavingsSourceInput,
    ): Promise<SavingsSource> => {
      const row: TablesInsert<'savings_sources'> = {
        id: input.id,
        household_id: input.householdId,
        name: input.name,
        amount: input.startingAmount,
      }
      const { data, error } = await supabase
        .from('savings_sources')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single()

      if (error) throw error
      return normalizeSource(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savingsKeys.sources() })
    },
  })
}

export function useRenameSavingsSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      name: string
    }): Promise<SavingsSource> => {
      const updates: TablesUpdate<'savings_sources'> = { name: input.name }
      const { data, error } = await supabase
        .from('savings_sources')
        .update(updates)
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error
      return normalizeSource(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savingsKeys.sources() })
    },
  })
}

export function useDeleteSavingsSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('savings_sources')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      // Transactions and rules cascade with the source.
      queryClient.invalidateQueries({ queryKey: savingsKeys.all })
    },
  })
}

export interface CreateSavingsTransactionInput {
  id: string
  sourceId: string
  type: SavingsTransactionType
  amount: number
  reason: string | null
  occurredAt: string
}

export type UpdateSavingsTransactionInput = CreateSavingsTransactionInput

function invalidateLedger(
  queryClient: ReturnType<typeof useQueryClient>,
  sourceId: string,
) {
  queryClient.invalidateQueries({
    queryKey: savingsKeys.transactions(sourceId),
  })
  // The balance trigger changed the source's amount.
  queryClient.invalidateQueries({ queryKey: savingsKeys.sources() })
}

export function useCreateSavingsTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: CreateSavingsTransactionInput,
    ): Promise<SavingsTransaction> => {
      const row: Omit<
        TablesInsert<'savings_transactions'>,
        'household_id' | 'created_by'
      > = {
        id: input.id,
        source_id: input.sourceId,
        type: input.type,
        amount: input.amount,
        reason: input.reason,
        occurred_at: input.occurredAt,
      }
      // household_id and created_by are trigger-derived; the codegen Insert
      // type cannot express trigger-populated columns.
      const { data, error } = await supabase
        .from('savings_transactions')
        .upsert(row as unknown as TablesInsert<'savings_transactions'>, {
          onConflict: 'id',
        })
        .select()
        .single()

      if (error) throw error
      return normalizeTransaction(data)
    },
    onSuccess: (_data, input) => {
      invalidateLedger(queryClient, input.sourceId)
    },
  })
}

export function useUpdateSavingsTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: UpdateSavingsTransactionInput,
    ): Promise<SavingsTransaction> => {
      const updates: TablesUpdate<'savings_transactions'> = {
        type: input.type,
        amount: input.amount,
        reason: input.reason,
        occurred_at: input.occurredAt,
      }
      const { data, error } = await supabase
        .from('savings_transactions')
        .update(updates)
        .eq('id', input.id)
        .eq('source_id', input.sourceId)
        .select()
        .single()

      if (error) throw error
      return normalizeTransaction(data)
    },
    onSuccess: (_data, input) => {
      invalidateLedger(queryClient, input.sourceId)
    },
  })
}

export function useDeleteSavingsTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      sourceId: string
    }): Promise<void> => {
      const { error } = await supabase
        .from('savings_transactions')
        .delete()
        .eq('id', input.id)
        .eq('source_id', input.sourceId)

      if (error) throw error
    },
    onSuccess: (_data, input) => {
      invalidateLedger(queryClient, input.sourceId)
    },
  })
}

export interface SaveDepositRuleInput {
  id: string
  sourceId: string
  amount: number
  dayOfMonth1: number
  dayOfMonth2: number
  startDate: string
  active: boolean
  description: string | null
}

/** Creates or updates a source's auto-deposit rule (upsert on id). */
export function useSaveSavingsDepositRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: SaveDepositRuleInput,
    ): Promise<SavingsDepositRule> => {
      const row: Omit<TablesInsert<'savings_deposit_rules'>, 'household_id'> = {
        id: input.id,
        source_id: input.sourceId,
        amount: input.amount,
        day_of_month_1: input.dayOfMonth1,
        day_of_month_2: input.dayOfMonth2,
        start_date: input.startDate,
        active: input.active,
        description: input.description,
      }
      const { data, error } = await supabase
        .from('savings_deposit_rules')
        .upsert(row as unknown as TablesInsert<'savings_deposit_rules'>, {
          onConflict: 'id',
        })
        .select()
        .single()

      if (error) throw error
      return normalizeRule(data)
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: savingsKeys.rules(input.sourceId),
      })
    },
  })
}

export function useDeleteSavingsDepositRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      sourceId: string
    }): Promise<void> => {
      const { error } = await supabase
        .from('savings_deposit_rules')
        .delete()
        .eq('id', input.id)
        .eq('source_id', input.sourceId)

      if (error) throw error
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: savingsKeys.rules(input.sourceId),
      })
    },
  })
}

/** Postgres unique_violation — another device already logged the occurrence. */
const UNIQUE_VIOLATION = '23505'

/**
 * Generates any auto-deposit occurrences that came due since each active
 * rule's last generation, then advances the rule's last_generated_date.
 * Runs once per Savings-tab mount ("catch up on open" — deliberately not a
 * server-side cron; see the design spec). Concurrent catch-up from the other
 * device is harmless: the partial unique index on (rule, occurred_at) makes
 * the loser's insert a no-op.
 */
export async function catchUpAutoDeposits(): Promise<void> {
  const today = todayKey()
  const { data: rules, error } = await supabase
    .from('savings_deposit_rules')
    .select('*')
    .eq('active', true)
  if (error) throw error

  for (const rule of rules ?? []) {
    const occurrences = semiMonthlyOccurrences(rule, today)
    if (occurrences.length === 0) continue

    let latestLogged: string | null = null
    for (const occurredAt of occurrences) {
      const { error: insertError } = await supabase
        .from('savings_transactions')
        .insert({
          id: crypto.randomUUID(),
          source_id: rule.source_id,
          type: 'deposit',
          amount: rule.amount,
          reason: rule.description || 'Auto-deposit',
          occurred_at: occurredAt,
          auto_deposit_rule_id: rule.id,
        } as unknown as TablesInsert<'savings_transactions'>)
      if (insertError && insertError.code !== UNIQUE_VIOLATION) {
        throw insertError
      }
      latestLogged = occurredAt
    }

    if (latestLogged) {
      const { error: ruleError } = await supabase
        .from('savings_deposit_rules')
        .update({ last_generated_date: latestLogged })
        .eq('id', rule.id)
      if (ruleError) throw ruleError
    }
  }
}

/**
 * Fires the catch-up once on mount and refreshes savings queries when it
 * logged anything. Failures are logged, not surfaced — the tab still renders,
 * and the next open retries.
 */
export function useCatchUpAutoDeposits() {
  const queryClient = useQueryClient()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    catchUpAutoDeposits()
      .then(() => {
        queryClient.invalidateQueries({ queryKey: savingsKeys.all })
      })
      .catch((error) => {
        console.error('Auto-deposit catch-up failed', error)
      })
  }, [queryClient])
}
