import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@household-hub/domain'
import {
  categoryProgress as sharedCategoryProgress,
  hasSpendingFromMonth as sharedHasSpendingFromMonth,
  monthSummaries as sharedMonthSummaries,
  spendingCategoryTotals as sharedSpendingCategoryTotals,
  statementTotals as sharedStatementTotals,
} from '@household-hub/application/feature-data'
import { supabase } from '@/lib/supabase'
import { withOptimisticOverlay } from '@/lib/operations'
import type { Tables } from '@/types/database'

export interface LedgerYear {
  id: string
  year: number
  revision: number
}

export type CategoryKind = 'income' | 'spending'

export interface MonthRow {
  id: string
  month: number
}

/** A category as it appears in one month (name/order can vary per month). */
export interface MonthCategory {
  id: string
  categoryId: string
  monthId: string
  name: string
  kind: CategoryKind
  sortOrder: number
  revision: number
}

export interface MonthLimit {
  categoryId: string
  monthId: string
  amountCents: number | null
  limitEntityId: string
  revision: number
}

export interface LedgerTransaction {
  id: string
  monthId: string
  categoryId: string
  assetId: string
  kind: CategoryKind
  amountCents: number
  occurredAt: string
  description: string
  revision: number
}

export interface LedgerYearData {
  months: MonthRow[]
  categories: MonthCategory[]
  limits: MonthLimit[]
  transactions: LedgerTransaction[]
}

/** All Ledger years in the household, newest first. */
export function useLedgerYears(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId ? queryKeys.ledger.years(householdId) : ['ledger', 'years', 'off'],
    enabled: !!householdId,
    queryFn: async (): Promise<LedgerYear[]> => {
      const { data, error } = await supabase
        .from('ledger_years')
        .select('id, year, revision')
        .order('year', { ascending: false })
        .returns<Pick<Tables<'ledger_years'>, 'id' | 'year' | 'revision'>[]>()
      if (error) throw error
      return withOptimisticOverlay(
        (data ?? []).map((r) => ({ id: r.id, year: r.year, revision: r.revision })),
        'ledger_year',
      )
    },
  })
}

/** Months, per-month categories, limits, and transactions for one year. */
export function useLedgerYearData(
  householdId: string | undefined,
  yearId: string | undefined,
) {
  return useQuery({
    queryKey:
      householdId && yearId
        ? [...queryKeys.ledger.years(householdId), yearId]
        : ['ledger', 'yeardata', 'off'],
    enabled: !!householdId && !!yearId,
    queryFn: async (): Promise<LedgerYearData> => {
      const months = await supabase
        .from('ledger_months')
        .select('id, month')
        .eq('year_id', yearId!)
        .order('month', { ascending: true })
        .returns<MonthRow[]>()
      if (months.error) throw months.error
      const monthIds = (months.data ?? []).map((m) => m.id)

      const [categories, kinds, limits, transactions] = await Promise.all([
        supabase
          .from('ledger_month_categories')
          .select('id, category_id, month_id, name, sort_order, revision')
          .in('month_id', monthIds)
          .returns<
            Pick<
              Tables<'ledger_month_categories'>,
              'id' | 'category_id' | 'month_id' | 'name' | 'sort_order' | 'revision'
            >[]
          >(),
        supabase
          .from('ledger_categories')
          .select('id, kind')
          .eq('year_id', yearId!)
          .returns<Pick<Tables<'ledger_categories'>, 'id' | 'kind'>[]>(),
        supabase
          .from('ledger_month_limits')
          .select('category_id, month_id, amount_cents, limit_entity_id, revision')
          .in('month_id', monthIds)
          .returns<
            Pick<
              Tables<'ledger_month_limits'>,
              'category_id' | 'month_id' | 'amount_cents' | 'limit_entity_id' | 'revision'
            >[]
          >(),
        supabase
          .from('ledger_transactions')
          .select('id, month_id, category_id, asset_id, kind, amount_cents, occurred_at, description, revision')
          .eq('year_id', yearId!)
          .order('occurred_at', { ascending: false })
          .returns<Tables<'ledger_transactions'>[]>(),
      ])
      if (categories.error) throw categories.error
      if (kinds.error) throw kinds.error
      if (limits.error) throw limits.error
      if (transactions.error) throw transactions.error

      const kindById = new Map<string, CategoryKind>()
      for (const c of kinds.data ?? []) kindById.set(c.id, c.kind as CategoryKind)

      return {
        months: months.data ?? [],
        categories: (categories.data ?? []).map((c) => ({
          id: c.id,
          categoryId: c.category_id,
          monthId: c.month_id,
          name: c.name,
          kind: kindById.get(c.category_id) ?? 'spending',
          sortOrder: c.sort_order,
          revision: c.revision,
        })),
        limits: (limits.data ?? []).map((l) => ({
          categoryId: l.category_id,
          monthId: l.month_id,
          amountCents: l.amount_cents,
          limitEntityId: l.limit_entity_id,
          revision: l.revision,
        })),
        transactions: (transactions.data ?? []).map((t) => ({
          id: t.id,
          monthId: t.month_id,
          categoryId: t.category_id,
          assetId: t.asset_id,
          kind: t.kind as CategoryKind,
          amountCents: t.amount_cents,
          occurredAt: t.occurred_at,
          description: t.description,
          revision: t.revision,
        })),
      }
    },
  })
}

export interface MonthSummary {
  monthId: string
  month: number
  incomeCents: number
  spendingCents: number
  netCents: number
}

/** Income/spending/net per month, derived from transactions. */
export function monthSummaries(data: LedgerYearData): MonthSummary[] {
  return sharedMonthSummaries(data)
}

export interface CategoryProgress {
  categoryId: string
  monthCategoryId: string
  name: string
  kind: CategoryKind
  sortOrder: number
  revision: number
  limitCents: number | null
  actualCents: number
  /** Fraction spent of the limit (0-1+), or null when no limit is set. */
  ratio: number | null
  overLimit: boolean
}

/** Category rows for one month with spend-vs-limit progress. */
export function categoryProgress(
  data: LedgerYearData,
  monthId: string,
): CategoryProgress[] {
  return sharedCategoryProgress(data, monthId)
}

/** Whether a category has any spending in this month or any later month. */
export function hasSpendingFromMonth(
  data: LedgerYearData,
  categoryId: string,
  fromMonth: number,
): boolean {
  return sharedHasSpendingFromMonth(data, categoryId, fromMonth)
}

export interface StatementTotals {
  incomeCents: number
  spendingCents: number
  limitCents: number
  leftCents: number
  utilization: number | null
}

/** Actual transaction totals and spending-only budget totals for a scope. */
export function statementTotals(
  data: LedgerYearData,
  monthId?: string,
): StatementTotals {
  return sharedStatementTotals(data, monthId)
}

/** Actual spending grouped by category for annual or monthly donuts. */
export function spendingCategoryTotals(
  data: LedgerYearData,
  monthId?: string,
): Array<{ categoryId: string; name: string; totalCents: number }> {
  return sharedSpendingCategoryTotals(data, monthId)
}
