import type { QueuedOperation } from '../operations'

export type CategoryKind = 'income' | 'spending'

export interface MonthRow { id: string; month: number }
export interface MonthCategory {
  id: string; categoryId: string; monthId: string; name: string
  kind: CategoryKind; sortOrder: number; revision: number
}
export interface MonthLimit {
  categoryId: string; monthId: string; amountCents: number | null
  limitEntityId: string; revision: number
}
export interface LedgerTransaction {
  id: string; monthId: string; categoryId: string; assetId: string
  kind: CategoryKind; amountCents: number; occurredAt: string
  description: string; revision: number
}
export interface LedgerYearData {
  months: MonthRow[]; categories: MonthCategory[]; limits: MonthLimit[]
  transactions: LedgerTransaction[]
}

export type TransactionPrerequisite = 'asset' | 'category'

export function resolveTransactionPrerequisite(
  kind: CategoryKind,
  hasCadAsset: boolean,
  categories: MonthCategory[],
): TransactionPrerequisite | null {
  if (!hasCadAsset) return 'asset'
  return categories.some((category) => category.kind === kind) ? null : 'category'
}

export function ensureLedgerYearMonths(yearId: string, data: LedgerYearData): LedgerYearData {
  if (data.months.length > 0) return data
  return {
    ...data,
    months: Array.from({ length: 12 }, (_, index) => ({
      id: `${yearId}:month:${index + 1}`,
      month: index + 1,
    })),
  }
}

/** Projects queued category/limit propagation into the month-shaped model. */
export function applyLedgerConfigurationOverlay(
  data: LedgerYearData,
  operations: QueuedOperation[],
  yearId: string,
): LedgerYearData {
  let categories = [...data.categories]
  let limits = [...data.limits]
  const months = [...data.months].sort((left, right) => left.month - right.month)

  for (const operation of [...operations].sort((left, right) => left.localSequence - right.localSequence)) {
    const payload = operation.command.payload
    const fromMonth = typeof payload.fromMonth === 'number' ? payload.fromMonth : null
    if (!fromMonth || fromMonth < 1 || fromMonth > 12) continue

    if (operation.entityType === 'ledger_category') {
      const categoryId = operation.entityId
      const affected = new Set(months.filter((month) => month.month >= fromMonth).map((month) => month.id))
      if (operation.optimistic === null) {
        categories = categories.filter((category) => category.categoryId !== categoryId || !affected.has(category.monthId))
        limits = limits.filter((limit) => limit.categoryId !== categoryId || !affected.has(limit.monthId))
        continue
      }
      if (payload.yearId !== yearId || typeof payload.name !== 'string' ||
          (payload.kind !== 'income' && payload.kind !== 'spending') ||
          typeof payload.sortOrder !== 'number') continue
      for (const month of months.filter((entry) => entry.month >= fromMonth)) {
        const index = categories.findIndex((category) => category.categoryId === categoryId && category.monthId === month.id)
        const current = index >= 0 ? categories[index] : null
        const next: MonthCategory = {
          id: current?.id ?? `${categoryId}:${month.id}`,
          categoryId, monthId: month.id, name: payload.name,
          kind: payload.kind, sortOrder: payload.sortOrder,
          revision: current?.revision ?? operation.command.baseRevision ?? 1,
        }
        if (index >= 0) categories[index] = next
        else categories.push(next)
      }
      continue
    }

    if (operation.entityType !== 'ledger_limit') continue
    const categoryId = typeof payload.categoryId === 'string' ? payload.categoryId : null
    if (!categoryId || !categories.some((category) => category.categoryId === categoryId)) continue
    const affectedMonths = months.filter((month) => month.month >= fromMonth)
    const affected = new Set(affectedMonths.map((month) => month.id))
    if (operation.optimistic === null) {
      limits = limits.filter((limit) => limit.categoryId !== categoryId || !affected.has(limit.monthId))
      continue
    }
    const amountCents = payload.amountCents === null || typeof payload.amountCents === 'number' ? payload.amountCents : null
    for (const month of affectedMonths) {
      const index = limits.findIndex((limit) => limit.categoryId === categoryId && limit.monthId === month.id)
      const current = index >= 0 ? limits[index] : null
      const next: MonthLimit = {
        categoryId, monthId: month.id, amountCents,
        limitEntityId: current?.limitEntityId ?? operation.entityId,
        revision: current?.revision ?? operation.command.baseRevision ?? 1,
      }
      if (index >= 0) limits[index] = next
      else limits.push(next)
    }
  }
  return { ...data, categories, limits }
}

export interface MonthSummary { monthId: string; month: number; incomeCents: number; spendingCents: number; netCents: number }
export function monthSummaries(data: LedgerYearData): MonthSummary[] {
  return data.months.map((month) => {
    let incomeCents = 0; let spendingCents = 0
    for (const transaction of data.transactions) {
      if (transaction.monthId !== month.id) continue
      if (transaction.kind === 'income') incomeCents += transaction.amountCents
      else spendingCents += transaction.amountCents
    }
    return { monthId: month.id, month: month.month, incomeCents, spendingCents, netCents: incomeCents - spendingCents }
  })
}

export interface CategoryProgress {
  categoryId: string; monthCategoryId: string; name: string; kind: CategoryKind
  sortOrder: number; revision: number; limitCents: number | null
  actualCents: number; ratio: number | null; overLimit: boolean
}
export function categoryProgress(data: LedgerYearData, monthId: string): CategoryProgress[] {
  const limits = new Map(data.limits.filter((limit) => limit.monthId === monthId).map((limit) => [limit.categoryId, limit.amountCents]))
  const actual = new Map<string, number>()
  for (const transaction of data.transactions) {
    if (transaction.monthId === monthId) actual.set(transaction.categoryId, (actual.get(transaction.categoryId) ?? 0) + transaction.amountCents)
  }
  return data.categories
    .filter((category) => category.monthId === monthId)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((category) => {
      const limitCents = limits.get(category.categoryId) ?? null
      const actualCents = actual.get(category.categoryId) ?? 0
      const ratio = limitCents && limitCents > 0 ? actualCents / limitCents : null
      return { categoryId: category.categoryId, monthCategoryId: category.id, name: category.name, kind: category.kind, sortOrder: category.sortOrder, revision: category.revision, limitCents, actualCents, ratio, overLimit: ratio !== null && ratio > 1 }
    })
}

export function hasSpendingFromMonth(data: LedgerYearData, categoryId: string, fromMonth: number): boolean {
  const monthNumberById = new Map(data.months.map((month) => [month.id, month.month]))
  return data.transactions.some((transaction) => transaction.categoryId === categoryId && (monthNumberById.get(transaction.monthId) ?? 0) >= fromMonth)
}

export interface StatementTotals { incomeCents: number; spendingCents: number; limitCents: number; leftCents: number; utilization: number | null }
export function statementTotals(data: LedgerYearData, monthId?: string): StatementTotals {
  const transactions = monthId ? data.transactions.filter((transaction) => transaction.monthId === monthId) : data.transactions
  const incomeCents = transactions.filter((transaction) => transaction.kind === 'income').reduce((sum, transaction) => sum + transaction.amountCents, 0)
  const spendingCents = transactions.filter((transaction) => transaction.kind === 'spending').reduce((sum, transaction) => sum + transaction.amountCents, 0)
  const spendingCategories = new Set(data.categories.filter((category) => category.kind === 'spending' && (!monthId || category.monthId === monthId)).map((category) => `${category.monthId}:${category.categoryId}`))
  const limitCents = data.limits.filter((limit) => (!monthId || limit.monthId === monthId) && spendingCategories.has(`${limit.monthId}:${limit.categoryId}`)).reduce((sum, limit) => sum + (limit.amountCents ?? 0), 0)
  return { incomeCents, spendingCents, limitCents, leftCents: limitCents - spendingCents, utilization: limitCents > 0 ? spendingCents / limitCents : null }
}

export function spendingCategoryTotals(data: LedgerYearData, monthId?: string): Array<{ categoryId: string; name: string; totalCents: number }> {
  const totals = new Map<string, number>(); const names = new Map<string, string>()
  for (const category of data.categories) if (category.kind === 'spending' && (!monthId || category.monthId === monthId) && !names.has(category.categoryId)) names.set(category.categoryId, category.name)
  for (const transaction of data.transactions) {
    if (transaction.kind !== 'spending' || (monthId && transaction.monthId !== monthId)) continue
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amountCents)
  }
  return [...totals.entries()].map(([categoryId, totalCents]) => ({ categoryId, name: names.get(categoryId) ?? 'Other', totalCents })).sort((left, right) => left.name.localeCompare(right.name))
}
