import { enqueueOperation, type EnqueueOutcome } from '@/lib/operations'

export interface TripInput {
  id: string
  name: string
  destination: string
  timezone: string
  startDate: string
  endDate: string
  destinationCurrency: string
}

/** Create/edit a trip. Destination currency is locked once expenses exist. */
export function saveTrip(
  householdId: string,
  input: TripInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    name: input.name.trim(),
    destination: input.destination.trim(),
    timezone: input.timezone,
    startDate: input.startDate,
    endDate: input.endDate,
    destinationCurrency: input.destinationCurrency.trim().toUpperCase(),
  }
  return enqueueOperation({
    householdId,
    type: 'trip.upsert',
    entityType: 'trip',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: payload,
  })
}

export function deleteTrip(
  householdId: string,
  tripId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'trip.delete',
    entityType: 'trip',
    entityId: tripId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}

export interface ExpenseInput {
  id: string
  tripId: string
  assetId: string
  amountCents: number
  currency: string
  spentAt: string
  description: string
}

/**
 * Create/edit a trip expense. A CAD expense debits the asset and auto-creates a
 * linked Ledger row (Statement + Travel category); a foreign-currency expense
 * debits the asset only. All of that is server-side — the client just sends the
 * command.
 */
export function saveExpense(
  householdId: string,
  input: ExpenseInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    tripId: input.tripId,
    assetId: input.assetId,
    amountCents: input.amountCents,
    currency: input.currency.trim().toUpperCase(),
    spentAt: input.spentAt,
    description: input.description.trim(),
  }
  return enqueueOperation({
    householdId,
    type: 'trip.expense.upsert',
    entityType: 'trip_expense',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: payload,
  })
}

export function deleteExpense(
  householdId: string,
  expenseId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'trip.expense.delete',
    entityType: 'trip_expense',
    entityId: expenseId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}
