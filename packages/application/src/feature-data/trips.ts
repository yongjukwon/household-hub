import {
  aggregateTripCurrencyBuckets,
  type Cents,
  type CurrencyCode,
  type TripCurrencyBucket,
} from '@household-hub/domain'

export interface Trip {
  id: string
  name: string
  destination: string
  destinationCurrency: string
  destinationTimezone: string
  startDate: string
  endDate: string
  revision: number
}

export interface TripExpense {
  id: string
  tripId: string
  assetId: string
  amountCents: number
  currencyCode: string
  description: string
  spentAt: string
  itineraryEntryId: string | null
  bookingEntryId: string | null
  revision: number
}

export interface ItineraryEntry {
  id: string
  tripId: string
  itemDate: string
  startTime: string | null
  title: string
  notes: string | null
  sortOrder: number
  revision: number
}

export type BookingKind = 'flight' | 'hotel' | 'car' | 'other'

export interface BookingEntry {
  id: string
  tripId: string
  kind: BookingKind
  title: string
  confirmationNumber: string | null
  address: string | null
  startsAt: string | null
  endsAt: string | null
  notes: string | null
  sortOrder: number
  revision: number
}

export interface ChecklistEntry {
  id: string
  tripId: string
  label: string
  checked: boolean
  sortOrder: number
  revision: number
}

export interface TripRow {
  id: string
  name: string
  destination: string
  destination_currency: string
  destination_timezone: string
  start_date: string
  end_date: string
  revision: number
}

export interface TripExpenseRow {
  id: string
  trip_id: string
  asset_id: string
  amount_cents: number
  currency_code: string
  description: string
  spent_at: string
  itinerary_entry_id: string | null
  booking_entry_id: string | null
  revision: number
}

export interface ItineraryEntryRow {
  id: string
  trip_id: string
  item_date: string
  start_time: string | null
  title: string
  notes: string | null
  sort_order: number
  revision: number
}

export interface BookingEntryRow {
  id: string
  trip_id: string
  kind: string
  title: string
  confirmation_number: string | null
  address: string | null
  starts_at: string | null
  ends_at: string | null
  notes: string | null
  sort_order: number
  revision: number
}

export interface ChecklistEntryRow {
  id: string
  trip_id: string
  label: string
  checked: boolean
  sort_order: number
  revision: number
}

export function mapTrip(row: TripRow): Trip {
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    destinationCurrency: row.destination_currency,
    destinationTimezone: row.destination_timezone,
    startDate: row.start_date,
    endDate: row.end_date,
    revision: row.revision,
  }
}

export function mapTripExpense(row: TripExpenseRow): TripExpense {
  return {
    id: row.id,
    tripId: row.trip_id,
    assetId: row.asset_id,
    amountCents: row.amount_cents,
    currencyCode: row.currency_code,
    description: row.description,
    spentAt: row.spent_at,
    itineraryEntryId: row.itinerary_entry_id,
    bookingEntryId: row.booking_entry_id,
    revision: row.revision,
  }
}

export function mapItineraryEntry(row: ItineraryEntryRow): ItineraryEntry {
  return {
    id: row.id,
    tripId: row.trip_id,
    itemDate: row.item_date,
    startTime: row.start_time,
    title: row.title,
    notes: row.notes,
    sortOrder: row.sort_order,
    revision: row.revision,
  }
}

export function mapBookingEntry(row: BookingEntryRow): BookingEntry {
  return {
    id: row.id,
    tripId: row.trip_id,
    kind: row.kind as BookingKind,
    title: row.title,
    confirmationNumber: row.confirmation_number,
    address: row.address,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    notes: row.notes,
    sortOrder: row.sort_order,
    revision: row.revision,
  }
}

export function mapChecklistEntry(row: ChecklistEntryRow): ChecklistEntry {
  return {
    id: row.id,
    tripId: row.trip_id,
    label: row.label,
    checked: row.checked,
    sortOrder: row.sort_order,
    revision: row.revision,
  }
}

export function sortChecklistEntries(items: ChecklistEntry[]): {
  unchecked: ChecklistEntry[]
  checked: ChecklistEntry[]
} {
  const bySort = (left: ChecklistEntry, right: ChecklistEntry) =>
    left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
  return {
    unchecked: items.filter((item) => !item.checked).sort(bySort),
    checked: items.filter((item) => item.checked).sort(bySort),
  }
}

export function expenseBuckets(expenses: TripExpense[]): TripCurrencyBucket[] {
  return aggregateTripCurrencyBuckets(
    expenses.map((expense) => ({
      currency: expense.currencyCode as CurrencyCode,
      amountCents: expense.amountCents as Cents,
    })),
  )
}
