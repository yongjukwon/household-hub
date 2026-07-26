import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@household-hub/domain'
import { supabase } from '@/lib/supabase'
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
      return (data ?? []).map((r) => ({ id: r.id, year: r.year, revision: r.revision }))
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
  return data.months.map((m) => {
    let income = 0
    let spending = 0
    for (const t of data.transactions) {
      if (t.monthId !== m.id) continue
      if (t.kind === 'income') income += t.amountCents
      else spending += t.amountCents
    }
    return {
      monthId: m.id,
      month: m.month,
      incomeCents: income,
      spendingCents: spending,
      netCents: income - spending,
    }
  })
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
  const limitByCategory = new Map<string, number | null>()
  for (const l of data.limits) {
    if (l.monthId === monthId) limitByCategory.set(l.categoryId, l.amountCents)
  }
  const actualByCategory = new Map<string, number>()
  for (const t of data.transactions) {
    if (t.monthId !== monthId) continue
    actualByCategory.set(
      t.categoryId,
      (actualByCategory.get(t.categoryId) ?? 0) + t.amountCents,
    )
  }
  return data.categories
    .filter((c) => c.monthId === monthId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((c) => {
      const limitCents = limitByCategory.get(c.categoryId) ?? null
      const actualCents = actualByCategory.get(c.categoryId) ?? 0
      const ratio =
        limitCents && limitCents > 0 ? actualCents / limitCents : null
      return {
        categoryId: c.categoryId,
        monthCategoryId: c.id,
        name: c.name,
        kind: c.kind,
        sortOrder: c.sortOrder,
        revision: c.revision,
        limitCents,
        actualCents,
        ratio,
        overLimit: ratio !== null && ratio > 1,
      }
    })
}

/** Whether a category has any spending in this month or any later month. */
export function hasSpendingFromMonth(
  data: LedgerYearData,
  categoryId: string,
  fromMonth: number,
): boolean {
  const monthNumberById = new Map(data.months.map((m) => [m.id, m.month]))
  return data.transactions.some(
    (t) =>
      t.categoryId === categoryId &&
      (monthNumberById.get(t.monthId) ?? 0) >= fromMonth,
  )
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
  const transactions = monthId
    ? data.transactions.filter((transaction) => transaction.monthId === monthId)
    : data.transactions
  const incomeCents = transactions
    .filter((transaction) => transaction.kind === 'income')
    .reduce((sum, transaction) => sum + transaction.amountCents, 0)
  const spendingCents = transactions
    .filter((transaction) => transaction.kind === 'spending')
    .reduce((sum, transaction) => sum + transaction.amountCents, 0)

  const spendingCategoryKeys = new Set(
    data.categories
      .filter(
        (category) =>
          category.kind === 'spending' &&
          (!monthId || category.monthId === monthId),
      )
      .map((category) => `${category.monthId}:${category.categoryId}`),
  )
  const limitCents = data.limits
    .filter(
      (limit) =>
        (!monthId || limit.monthId === monthId) &&
        spendingCategoryKeys.has(`${limit.monthId}:${limit.categoryId}`),
    )
    .reduce((sum, limit) => sum + (limit.amountCents ?? 0), 0)

  return {
    incomeCents,
    spendingCents,
    limitCents,
    leftCents: limitCents - spendingCents,
    utilization: limitCents > 0 ? spendingCents / limitCents : null,
  }
}

/** Actual spending grouped by category for annual or monthly donuts. */
export function spendingCategoryTotals(
  data: LedgerYearData,
  monthId?: string,
): Array<{ categoryId: string; name: string; totalCents: number }> {
  const totals = new Map<string, number>()
  const names = new Map<string, string>()
  for (const category of data.categories) {
    if (
      category.kind === 'spending' &&
      (!monthId || category.monthId === monthId) &&
      !names.has(category.categoryId)
    ) {
      names.set(category.categoryId, category.name)
    }
  }
  for (const transaction of data.transactions) {
    if (
      transaction.kind !== 'spending' ||
      (monthId && transaction.monthId !== monthId)
    ) {
      continue
    }
    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + transaction.amountCents,
    )
  }
  return [...totals.entries()]
    .map(([categoryId, totalCents]) => ({
      categoryId,
      name: names.get(categoryId) ?? 'Other',
      totalCents,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}
