import { useQuery } from '@tanstack/react-query'
import {
  aggregateTripCurrencyBuckets,
  queryKeys,
  type Cents,
  type CurrencyCode,
  type TripCurrencyBucket,
} from '@household-hub/domain'
import { supabase } from '@/lib/supabase'
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
      return (data ?? []).map(toTrip)
    },
  })
}

/** A trip with its expenses (newest first). */
export function useTrip(householdId: string | undefined, tripId: string | undefined) {
  return useQuery({
    queryKey:
      householdId && tripId
        ? queryKeys.trips.trip(householdId, tripId)
        : ['trips', 'trip', 'off'],
    enabled: !!householdId && !!tripId,
    queryFn: async (): Promise<{ trip: Trip | null; expenses: TripExpense[] }> => {
      const [tripRes, expensesRes] = await Promise.all([
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
      ])
      if (tripRes.error) throw tripRes.error
      if (expensesRes.error) throw expensesRes.error
      return {
        trip: tripRes.data ? toTrip(tripRes.data) : null,
        expenses: (expensesRes.data ?? []).map((r) => ({
          id: r.id,
          tripId: r.trip_id,
          assetId: r.asset_id,
          amountCents: r.amount_cents,
          currencyCode: r.currency_code,
          description: r.description,
          spentAt: r.spent_at,
          revision: r.revision,
        })),
      }
    },
  })
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
