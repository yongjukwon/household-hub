import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Card } from '@/components/Card'
import { ChevronRightIcon, PlusIcon } from '@/components/icons'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { useTrips, type Trip } from '@/features/trips/data'
import { TripSheet } from '@/features/trips/TripSheet'
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

  function openTrip(trip: Trip) {
    router.push({ pathname: '/trips/[tripId]', params: { tripId: trip.id } })
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
      <FlatList
        data={trips.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={[styles.pageTitle, { color: tokens.ink }]}>
              Trips
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New trip"
              onPress={() => setAdding(true)}
              style={[styles.addButton, { backgroundColor: tokens.accent }]}
            >
              <PlusIcon size={18} color={tokens.accentContrast} />
            </Pressable>
          </View>
        }
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
          <Pressable onPress={() => openTrip(item)} style={styles.rowWrap}>
            <Card style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: tokens.ink }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.rowMeta, { color: tokens.muted }]} numberOfLines={1}>
                  {item.destination} · {formatRange(item.startDate, item.endDate)}
                </Text>
              </View>
              <ChevronRightIcon size={18} color={tokens.muted} />
            </Card>
          </Pressable>
        )}
      />

      {householdId ? (
        <TripSheet open={adding} onOpenChange={setAdding} householdId={householdId} trip={null} />
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 24, flexGrow: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowWrap: { marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 8 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 13, marginTop: 2 },
})
