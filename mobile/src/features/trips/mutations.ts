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
    optimistic: {
      ...payload,
      destinationTimezone: payload.timezone,
      revision: baseRevision ?? 1,
    },
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
  itineraryEntryId: string | null
  bookingEntryId: string | null
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
    itineraryEntryId: input.itineraryEntryId,
    bookingEntryId: input.bookingEntryId,
  }
  return enqueueOperation({
    householdId,
    type: 'trip.expense.upsert',
    entityType: 'trip_expense',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: {
      ...payload,
      currencyCode: payload.currency,
      revision: baseRevision ?? 1,
    },
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

export interface ItineraryEntryInput {
  id: string
  tripId: string
  itemDate: string
  startTime: string | null
  title: string
  notes: string | null
  sortOrder: number
}

/** Create/edit an Itinerary entry. */
export function saveItineraryEntry(
  householdId: string,
  input: ItineraryEntryInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    tripId: input.tripId,
    itemDate: input.itemDate,
    startTime: input.startTime,
    title: input.title.trim(),
    notes: input.notes && input.notes.trim().length > 0 ? input.notes.trim() : null,
    sortOrder: input.sortOrder,
  }
  return enqueueOperation({
    householdId,
    type: 'trip.itinerary.upsert',
    entityType: 'trip_itinerary_entry',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: { ...payload, revision: baseRevision ?? 1 },
  })
}

export function deleteItineraryEntry(
  householdId: string,
  entryId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'trip.itinerary.delete',
    entityType: 'trip_itinerary_entry',
    entityId: entryId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}

export interface BookingEntryInput {
  id: string
  tripId: string
  kind: 'flight' | 'hotel' | 'car' | 'other'
  title: string
  confirmationNumber: string | null
  address: string | null
  startsAt: string | null
  endsAt: string | null
  notes: string | null
  sortOrder: number
}

/** Create/edit a Booking. */
export function saveBookingEntry(
  householdId: string,
  input: BookingEntryInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    tripId: input.tripId,
    kind: input.kind,
    title: input.title.trim(),
    confirmationNumber:
      input.confirmationNumber && input.confirmationNumber.trim().length > 0
        ? input.confirmationNumber.trim()
        : null,
    address: input.address && input.address.trim().length > 0 ? input.address.trim() : null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    notes: input.notes && input.notes.trim().length > 0 ? input.notes.trim() : null,
    sortOrder: input.sortOrder,
  }
  return enqueueOperation({
    householdId,
    type: 'trip.booking.upsert',
    entityType: 'trip_booking_entry',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: { ...payload, revision: baseRevision ?? 1 },
  })
}

export function deleteBookingEntry(
  householdId: string,
  entryId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'trip.booking.delete',
    entityType: 'trip_booking_entry',
    entityId: entryId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}

export interface ChecklistEntryInput {
  id: string
  tripId: string
  label: string
  checked: boolean
  sortOrder: number
}

/** Create/edit a Checklist entry. */
export function saveChecklistEntry(
  householdId: string,
  input: ChecklistEntryInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    tripId: input.tripId,
    label: input.label.trim(),
    checked: input.checked,
    sortOrder: input.sortOrder,
  }
  return enqueueOperation({
    householdId,
    type: 'trip.checklist.upsert',
    entityType: 'trip_checklist_entry',
    entityId: input.id,
    baseRevision,
    payload,
    optimistic: { ...payload, revision: baseRevision ?? 1 },
  })
}

/** Toggle a Checklist entry's checked state, preserving its other fields. */
export function toggleChecklistEntry(
  householdId: string,
  item: import('./data').ChecklistEntry,
  checked: boolean,
): Promise<EnqueueOutcome> {
  return saveChecklistEntry(
    householdId,
    {
      id: item.id,
      tripId: item.tripId,
      label: item.label,
      checked,
      sortOrder: item.sortOrder,
    },
    item.revision,
  )
}

export function deleteChecklistEntry(
  householdId: string,
  entryId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'trip.checklist.delete',
    entityType: 'trip_checklist_entry',
    entityId: entryId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}
