import { enqueueOperation, type EnqueueOutcome } from '@/lib/operations'
import type { CategoryKind } from './statements'

/** Create a Ledger year (the server also seeds its 12 months). */
export function createYear(
  householdId: string,
  yearId: string,
  year: number,
): Promise<EnqueueOutcome> {
  const payload = { year }
  return enqueueOperation({
    householdId,
    type: 'ledger.year.upsert',
    entityType: 'ledger_year',
    entityId: yearId,
    baseRevision: null,
    payload,
    optimistic: { ...payload, revision: 1 },
  })
}

/** Clear all data in a typed year; `confirmation` must equal the year. */
export function clearYear(
  householdId: string,
  yearId: string,
  year: number,
  baseRevision: number,
): Promise<EnqueueOutcome> {
  const payload = { year, confirmation: String(year) }
  return enqueueOperation({
    householdId,
    type: 'ledger.year.clear',
    entityType: 'ledger_year',
    entityId: yearId,
    baseRevision,
    payload,
    optimistic: null,
  })
}

export interface CategoryInput {
  id: string
  yearId: string
  fromMonth: number
  name: string
  kind: CategoryKind
  sortOrder: number
}

/** Create/rename a category from `fromMonth` forward to December. */
export function saveCategory(
  householdId: string,
  input: CategoryInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    yearId: input.yearId,
    fromMonth: input.fromMonth,
    name: input.name.trim(),
    kind: input.kind,
    sortOrder: input.sortOrder,
  }
  return enqueueOperation({
    householdId,
    type: 'ledger.category.upsert',
    entityType: 'ledger_category',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: payload,
  })
}

/**
 * Delete a category from `fromMonth` forward. The server blocks this when the
 * selected or a later month already has spending — surfaced as a discard.
 */
export function deleteCategory(
  householdId: string,
  categoryId: string,
  yearId: string,
  fromMonth: number,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = { yearId, fromMonth }
  return enqueueOperation({
    householdId,
    type: 'ledger.category.delete',
    entityType: 'ledger_category',
    entityId: categoryId,
    baseRevision,
    payload,
    optimistic: null,
  })
}

/** Set a category's monthly limit from `fromMonth` forward (null clears it). */
export function saveLimit(
  householdId: string,
  limitEntityId: string,
  categoryId: string,
  yearId: string,
  fromMonth: number,
  amountCents: number | null,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = { categoryId, fromMonth, amountCents }
  return enqueueOperation({
    householdId,
    type: 'ledger.limit.upsert',
    entityType: 'ledger_limit',
    entityId: limitEntityId,
    baseRevision,
    payload,
    optimistic: { ...payload, yearId },
  })
}

export interface TransactionInput {
  id: string
  yearId: string
  month: number
  categoryId: string
  assetId: string
  kind: CategoryKind
  amountCents: number
  occurredAt: string
  description: string
}

export function saveTransaction(
  householdId: string,
  input: TransactionInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    yearId: input.yearId,
    month: input.month,
    categoryId: input.categoryId,
    assetId: input.assetId,
    kind: input.kind,
    amountCents: input.amountCents,
    occurredAt: input.occurredAt,
    description: input.description.trim(),
  }
  return enqueueOperation({
    householdId,
    type: 'ledger.transaction.upsert',
    entityType: 'ledger_transaction',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: payload,
  })
}

export function deleteTransaction(
  householdId: string,
  transactionId: string,
  yearId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'ledger.transaction.delete',
    entityType: 'ledger_transaction',
    entityId: transactionId,
    baseRevision,
    payload: { yearId },
    optimistic: null,
  })
}
