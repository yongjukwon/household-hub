import { useQuery } from '@tanstack/react-query'
import {
  aggregateTripCurrencyBuckets,
  queryKeys,
  type Cents,
  type CurrencyCode,
  type TripCurrencyBucket,
} from '@household-hub/domain'
import { supabase } from '@/lib/supabase'
import { withOptimisticOverlay } from '@/lib/operations'
import type { Tables } from '@/types/database'

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

function toTrip(r: Tables<'household_trips'>): Trip {
  return {
    id: r.id,
    name: r.name,
    destination: r.destination,
    destinationCurrency: r.destination_currency,
    destinationTimezone: r.destination_timezone,
    startDate: r.start_date,
    endDate: r.end_date,
    revision: r.revision,
  }
}

/** All trips in the household, most recent start date first. */
export function useTrips(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId ? queryKeys.trips.list(householdId) : ['trips', 'off'],
    enabled: !!householdId,
    queryFn: async (): Promise<Trip[]> => {
      const { data, error } = await supabase
        .from('household_trips')
        .select('*')
        .order('start_date', { ascending: false })
        .returns<Tables<'household_trips'>[]>()
      if (error) throw error
      return withOptimisticOverlay((data ?? []).map(toTrip), 'trip')
    },
  })
}

/** A trip with its expenses, itinerary, bookings, and checklist. */
export function useTrip(householdId: string | undefined, tripId: string | undefined) {
  return useQuery({
    queryKey:
      householdId && tripId
        ? queryKeys.trips.trip(householdId, tripId)
        : ['trips', 'trip', 'off'],
    enabled: !!householdId && !!tripId,
    queryFn: async (): Promise<{
      trip: Trip | null
      expenses: TripExpense[]
      itinerary: ItineraryEntry[]
      bookings: BookingEntry[]
      checklist: ChecklistEntry[]
    }> => {
      const [tripRes, expensesRes, itineraryRes, bookingsRes, checklistRes] =
        await Promise.all([
          supabase
            .from('household_trips')
            .select('*')
            .eq('id', tripId!)
            .maybeSingle()
            .returns<Tables<'household_trips'> | null>(),
          supabase
            .from('trip_expenses')
            .select('*')
            .eq('trip_id', tripId!)
            .order('spent_at', { ascending: false })
            .returns<Tables<'trip_expenses'>[]>(),
          supabase
            .from('trip_itinerary_entries')
            .select('*')
            .eq('trip_id', tripId!)
            .order('item_date', { ascending: true })
            .order('sort_order', { ascending: true })
            .returns<Tables<'trip_itinerary_entries'>[]>(),
          supabase
            .from('trip_booking_entries')
            .select('*')
            .eq('trip_id', tripId!)
            .order('sort_order', { ascending: true })
            .returns<Tables<'trip_booking_entries'>[]>(),
          supabase
            .from('trip_checklist_entries')
            .select('*')
            .eq('trip_id', tripId!)
            .order('sort_order', { ascending: true })
            .returns<Tables<'trip_checklist_entries'>[]>(),
        ])
      if (tripRes.error) throw tripRes.error
      if (expensesRes.error) throw expensesRes.error
      if (itineraryRes.error) throw itineraryRes.error
      if (bookingsRes.error) throw bookingsRes.error
      if (checklistRes.error) throw checklistRes.error
      const tripRows = await withOptimisticOverlay(
        tripRes.data ? [toTrip(tripRes.data)] : [],
        'trip',
      )
      const expenses = await withOptimisticOverlay(
        (expensesRes.data ?? []).map((r) => ({
          id: r.id,
          tripId: r.trip_id,
          assetId: r.asset_id,
          amountCents: r.amount_cents,
          currencyCode: r.currency_code,
          description: r.description,
          spentAt: r.spent_at,
          itineraryEntryId: r.itinerary_entry_id,
          bookingEntryId: r.booking_entry_id,
          revision: r.revision,
        })),
        'trip_expense',
      )
      const itinerary = await withOptimisticOverlay(
        (itineraryRes.data ?? []).map(toItineraryEntry),
        'trip_itinerary_entry',
      )
      const bookings = await withOptimisticOverlay(
        (bookingsRes.data ?? []).map(toBookingEntry),
        'trip_booking_entry',
      )
      const checklist = await withOptimisticOverlay(
        (checklistRes.data ?? []).map(toChecklistEntry),
        'trip_checklist_entry',
      )
      return {
        trip: tripRows[0] ?? null,
        expenses: expenses.filter((expense) => expense.tripId === tripId),
        itinerary: itinerary.filter((entry) => entry.tripId === tripId),
        bookings: bookings.filter((entry) => entry.tripId === tripId),
        checklist: checklist.filter((entry) => entry.tripId === tripId),
      }
    },
  })
}

function toItineraryEntry(r: Tables<'trip_itinerary_entries'>): ItineraryEntry {
  return {
    id: r.id,
    tripId: r.trip_id,
    itemDate: r.item_date,
    startTime: r.start_time,
    title: r.title,
    notes: r.notes,
    sortOrder: r.sort_order,
    revision: r.revision,
  }
}

function toBookingEntry(r: Tables<'trip_booking_entries'>): BookingEntry {
  return {
    id: r.id,
    tripId: r.trip_id,
    kind: r.kind as BookingKind,
    title: r.title,
    confirmationNumber: r.confirmation_number,
    address: r.address,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    notes: r.notes,
    sortOrder: r.sort_order,
    revision: r.revision,
  }
}

function toChecklistEntry(r: Tables<'trip_checklist_entries'>): ChecklistEntry {
  return {
    id: r.id,
    tripId: r.trip_id,
    label: r.label,
    checked: r.checked,
    sortOrder: r.sort_order,
    revision: r.revision,
  }
}

/** Checklist items, unchecked first (each group by sort order). */
export function sortChecklistEntries(items: ChecklistEntry[]): {
  unchecked: ChecklistEntry[]
  checked: ChecklistEntry[]
} {
  const bySort = (left: ChecklistEntry, right: ChecklistEntry) =>
    left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
  return {
    unchecked: items.filter((i) => !i.checked).sort(bySort),
    checked: items.filter((i) => i.checked).sort(bySort),
  }
}

/**
 * Per-currency expense totals. Amounts are summed only within the same
 * currency — CAD and destination-currency spending are never converted or
 * combined (delegates to the shared domain aggregator).
 */
export function expenseBuckets(expenses: TripExpense[]): TripCurrencyBucket[] {
  return aggregateTripCurrencyBuckets(
    expenses.map((e) => ({
      currency: e.currencyCode as CurrencyCode,
      amountCents: e.amountCents as Cents,
    })),
  )
}
