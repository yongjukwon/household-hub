import { useQuery, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@household-hub/domain'
import { supabase } from '@/lib/supabase'
import {
  getOperationStore,
  withOptimisticOverlay,
  type QueuedOperation,
} from '@/lib/operations'
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

export type TransactionPrerequisite = 'asset' | 'category'

/** Returns the first unmet requirement for a CAD Ledger transaction. */
export function resolveTransactionPrerequisite(
  kind: CategoryKind,
  hasCadAsset: boolean,
  categories: MonthCategory[],
): TransactionPrerequisite | null {
  if (!hasCadAsset) return 'asset'
  return categories.some((category) => category.kind === kind)
    ? null
    : 'category'
}

/**
 * Projects queued category and limit commands into the month-shaped Budget
 * read model. The server stores the propagation rule on the year/category
 * entities, while the UI reads per-month rows, so the generic entity overlay
 * cannot represent these commands by itself.
 */
export function applyLedgerConfigurationOverlay(
  data: LedgerYearData,
  operations: QueuedOperation[],
  yearId: string,
): LedgerYearData {
  let categories = [...data.categories]
  let limits = [...data.limits]
  const months = [...data.months].sort((left, right) => left.month - right.month)

  for (const operation of [...operations].sort(
    (left, right) => left.localSequence - right.localSequence,
  )) {
    const payload = operation.command.payload
    const fromMonth =
      typeof payload.fromMonth === 'number' ? payload.fromMonth : null
    if (!fromMonth || fromMonth < 1 || fromMonth > 12) continue

    if (operation.entityType === 'ledger_category') {
      const categoryId = operation.entityId

      if (operation.optimistic === null) {
        const belongsToYear = categories.some(
          (category) => category.categoryId === categoryId,
        )
        if (!belongsToYear) continue
        const affectedMonthIds = new Set(
          months
            .filter((month) => month.month >= fromMonth)
            .map((month) => month.id),
        )
        categories = categories.filter(
          (category) =>
            category.categoryId !== categoryId ||
            !affectedMonthIds.has(category.monthId),
        )
        limits = limits.filter(
          (limit) =>
            limit.categoryId !== categoryId ||
            !affectedMonthIds.has(limit.monthId),
        )
        continue
      }

      if (payload.yearId !== yearId) continue
      if (
        typeof payload.name !== 'string' ||
        (payload.kind !== 'income' && payload.kind !== 'spending') ||
        typeof payload.sortOrder !== 'number'
      ) {
        continue
      }

      for (const month of months) {
        if (month.month < fromMonth) continue
        const index = categories.findIndex(
          (category) =>
            category.categoryId === categoryId &&
            category.monthId === month.id,
        )
        const current = index >= 0 ? categories[index] : null
        const next: MonthCategory = {
          id: current?.id ?? `${categoryId}:${month.id}`,
          categoryId,
          monthId: month.id,
          name: payload.name,
          kind: payload.kind,
          sortOrder: payload.sortOrder,
          revision: current?.revision ?? operation.command.baseRevision ?? 1,
        }
        if (index >= 0) categories[index] = next
        else categories.push(next)
      }
      continue
    }

    if (operation.entityType !== 'ledger_limit') continue
    const categoryId =
      typeof payload.categoryId === 'string' ? payload.categoryId : null
    if (!categoryId) continue
    const belongsToYear = categories.some(
      (category) => category.categoryId === categoryId,
    )
    if (!belongsToYear) continue
    const affectedMonths = months.filter((month) => month.month >= fromMonth)

    if (operation.optimistic === null) {
      const affectedMonthIds = new Set(affectedMonths.map((month) => month.id))
      limits = limits.filter(
        (limit) =>
          limit.categoryId !== categoryId ||
          !affectedMonthIds.has(limit.monthId),
      )
      continue
    }

    const amountCents =
      payload.amountCents === null || typeof payload.amountCents === 'number'
        ? payload.amountCents
        : null
    for (const month of affectedMonths) {
      const index = limits.findIndex(
        (limit) =>
          limit.categoryId === categoryId && limit.monthId === month.id,
      )
      const current = index >= 0 ? limits[index] : null
      const next: MonthLimit = {
        categoryId,
        monthId: month.id,
        amountCents,
        limitEntityId: current?.limitEntityId ?? operation.entityId,
        revision: current?.revision ?? operation.command.baseRevision ?? 1,
      }
      if (index >= 0) limits[index] = next
      else limits.push(next)
    }
  }

  return { ...data, categories, limits }
}

/**
 * A newly queued year is visible through the optimistic year overlay before
 * Supabase can return its server-created month rows. Supply the known
 * twelve-month shell so its Budget page is immediately usable offline.
 */
export function ensureLedgerYearMonths(
  yearId: string,
  data: LedgerYearData,
): LedgerYearData {
  if (data.months.length > 0) return data
  return {
    ...data,
    months: Array.from({ length: 12 }, (_, index) => ({
      id: `${yearId}:month:${index + 1}`,
      month: index + 1,
    })),
  }
}

/** Seed both Ledger caches when a new Statement is durably queued offline. */
export function seedPendingLedgerYear(
  client: QueryClient,
  householdId: string,
  yearId: string,
  year: number,
): void {
  const yearsKey = queryKeys.ledger.years(householdId)
  client.setQueryData<LedgerYear[]>(yearsKey, (current = []) => {
    if (current.some((entry) => entry.id === yearId)) return current
    return [{ id: yearId, year, revision: 1 }, ...current].sort(
      (a, b) => b.year - a.year,
    )
  })
  client.setQueryData<LedgerYearData>(
    [...yearsKey, yearId],
    (current) =>
      ensureLedgerYearMonths(yearId, current ?? {
        months: [],
        categories: [],
        limits: [],
        transactions: [],
      }),
  )
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

      const authoritative = ensureLedgerYearMonths(yearId!, {
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
      })
      const operations = await getOperationStore().listOperations()
      return applyLedgerConfigurationOverlay(
        authoritative,
        operations,
        yearId!,
      )
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
