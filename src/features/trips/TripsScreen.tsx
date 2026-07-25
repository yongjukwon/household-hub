import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Screen } from '@/shell/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import { useActiveHousehold } from '@/features/household'
import { useTrips } from './data'
import { TripSheet } from './TripSheet'

function formatRange(startDate: string, endDate: string): string {
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${d}T00:00:00Z`))
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`
}

/** Trips destination: the list of trips. */
export function TripsScreen() {
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const trips = useTrips(householdId)
  const [adding, setAdding] = useState(false)

  const addButton = (
    <button
      type="button"
      onClick={() => setAdding(true)}
      aria-label="New trip"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hh-accent)] text-white"
    >
      <PlusIcon className="h-5 w-5" />
    </button>
  )

  return (
    <Screen title="Trips" action={addButton}>
      {trips.isLoading ? (
        <LoadingState />
      ) : trips.isError ? (
        <ErrorState message="Could not load your trips." onRetry={() => void trips.refetch()} />
      ) : (trips.data ?? []).length === 0 ? (
        <EmptyState
          title="No trips yet"
          hint="Plan a trip to track its expenses."
          action={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2 font-medium text-white"
            >
              New trip
            </button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {(trips.data ?? []).map((trip) => (
            <li key={trip.id}>
              <Link
                to={`/trips/${trip.id}`}
                className="flex items-center justify-between rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]"
              >
                <span>
                  <span className="block font-medium text-[var(--hh-ink)]">{trip.name}</span>
                  <span className="block text-sm text-[var(--hh-muted)]">
                    {trip.destination} · {formatRange(trip.startDate, trip.endDate)}
                  </span>
                </span>
                <ChevronRightIcon className="h-5 w-5 text-[var(--hh-muted)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {householdId && <TripSheet open={adding} onOpenChange={setAdding} householdId={householdId} trip={null} />}
    </Screen>
  )
}
