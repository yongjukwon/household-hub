import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DetailListRow } from '@/components/DetailListRow'
import { FloatingActionButton } from '@/components/FloatingActionButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { useTrips, type Trip } from '@/features/trips/data'
import { deleteTrip } from '@/features/trips/mutations'
import { TripSheet } from '@/features/trips/TripSheet'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { useTheme } from '@/theme/tokens'

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
export default function TripsScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const trips = useTrips(householdId)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Trip | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openTrip(trip: Trip) {
    router.push({ pathname: '/trips/[tripId]', params: { tripId: trip.id } })
  }

  async function confirmDelete() {
    if (!householdId || !deleting) return
    setDeletingBusy(true)
    setDeleteError(null)
    try {
      const outcome = await deleteTrip(
        householdId,
        deleting.id,
        deleting.revision,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setDeleteError(outcomeError)
        return
      }
      setDeleting(null)
    } catch (error) {
      setDeleteError(operationThrownError(error, 'Could not delete this trip.'))
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['bottom']}>
      <FlatList
        data={trips.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          trips.isLoading ? (
            <LoadingState />
          ) : trips.isError ? (
            <ErrorState message="Could not load your trips." onRetry={() => void trips.refetch()} />
          ) : (
            <EmptyState title="No trips yet" hint="Tap + to plan a trip." />
          )
        }
        renderItem={({ item }) => (
          <DetailListRow
            title={item.name}
            subtitle={`${item.destination} · ${formatRange(item.startDate, item.endDate)}`}
            openLabel={`Open ${item.name}`}
            deleteLabel={`Delete ${item.name}`}
            onOpen={() => openTrip(item)}
            onDelete={() => {
              setDeleteError(null)
              setDeleting(item)
            }}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <FloatingActionButton accessibilityLabel="New trip" onPress={() => setAdding(true)} />

      {householdId ? (
        <TripSheet open={adding} onOpenChange={setAdding} householdId={householdId} trip={null} />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !deletingBusy) {
            setDeleteError(null)
            setDeleting(null)
          }
        }}
        title={`Delete ${deleting?.name ?? 'trip'}?`}
        description="This permanently removes the trip and its related itinerary, bookings, checklist, and expenses."
        error={deleteError}
        confirmLabel="Delete"
        confirmDisabled={deletingBusy}
        onConfirm={() => void confirmDelete()}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 90, flexGrow: 1 },
  separator: { height: 8 },
})
