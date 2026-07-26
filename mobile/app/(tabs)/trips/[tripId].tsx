import { formatMoney } from '@household-hub/domain'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Card } from '@/components/Card'
import { ChevronLeftIcon, PencilIcon } from '@/components/icons'
import { EditableTitle } from '@/components/EditableTitle'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useActiveHousehold } from '@/features/household'
import { useLedgerAssets, type LedgerAsset } from '@/features/ledger/assets'
import { expenseBuckets, useTrip, type Trip, type TripExpense } from '@/features/trips/data'
import { ExpenseSheet } from '@/features/trips/ExpenseSheet'
import { TripSheet } from '@/features/trips/TripSheet'
import { saveTrip } from '@/features/trips/mutations'
import { operationOutcomeError } from '@/lib/operations'
import { useTheme } from '@/theme/tokens'

type TripTab = 'itinerary' | 'bookings' | 'checklist' | 'expenses'

const TABS: { value: TripTab; label: string }[] = [
  { value: 'itinerary', label: 'Itinerary' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'expenses', label: 'Expenses' },
]

/** Trip detail: header + Itinerary/Bookings/Checklist/Expenses tabs. */
export default function TripScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const { tripId } = useLocalSearchParams<{ tripId: string }>()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const query = useTrip(householdId, tripId)
  const assets = useLedgerAssets(householdId)
  const [tab, setTab] = useState<TripTab>('expenses')
  const [editTrip, setEditTrip] = useState(false)

  const trip = query.data?.trip ?? null

  async function renameTrip(next: string): Promise<string | null> {
    if (!householdId || !trip) return 'The trip is not available.'
    const outcome = await saveTrip(
      householdId,
      {
        id: trip.id,
        name: next,
        destination: trip.destination,
        timezone: trip.destinationTimezone,
        startDate: trip.startDate,
        endDate: trip.endDate,
        destinationCurrency: trip.destinationCurrency,
      },
      trip.revision,
    )
    return operationOutcomeError(outcome)
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.replace('/trips')} style={styles.backRow}>
          <ChevronLeftIcon size={16} color={tokens.muted} />
          <Text style={[styles.backLabel, { color: tokens.muted }]}>All trips</Text>
        </Pressable>

        {trip ? (
          <View style={styles.titleRow}>
            <EditableTitle value={trip.name} accessibilityLabel="Trip name" onSave={renameTrip} />
          </View>
        ) : (
          <Text style={[styles.pageTitle, { color: tokens.ink }]}>Trip</Text>
        )}

        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message="Could not load this trip." onRetry={() => void query.refetch()} />
        ) : !trip ? (
          <EmptyState title="Trip not found" hint="It may have been deleted." />
        ) : (
          <View style={styles.stack}>
            <Card style={styles.headerCard}>
              <View style={styles.headerCardText}>
                <Text style={[styles.destination, { color: tokens.ink }]}>{trip.destination}</Text>
                <Text style={[styles.dates, { color: tokens.muted }]}>
                  {trip.startDate} – {trip.endDate} · {trip.destinationTimezone}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit trip"
                onPress={() => setEditTrip(true)}
                hitSlop={6}
              >
                <PencilIcon size={18} color={tokens.muted} />
              </Pressable>
            </Card>

            <SegmentedControl
              label="Trip section"
              value={tab}
              onChange={setTab}
              options={TABS}
            />

            {tab === 'expenses' && householdId ? (
              <ExpensesTab
                householdId={householdId}
                trip={trip}
                expenses={query.data?.expenses ?? []}
                assets={assets.data ?? []}
              />
            ) : tab !== 'expenses' ? (
              <EmptyState
                title={`${TABS.find((t) => t.value === tab)?.label} coming soon`}
                hint="Itinerary, bookings, and checklists arrive with the next trip-content update."
              />
            ) : null}
          </View>
        )}
      </ScrollView>

      {householdId && trip ? (
        <TripSheet open={editTrip} onOpenChange={setEditTrip} householdId={householdId} trip={trip} />
      ) : null}
    </SafeAreaView>
  )
}

function ExpensesTab({
  householdId,
  trip,
  expenses,
  assets,
}: {
  householdId: string
  trip: Trip
  expenses: TripExpense[]
  assets: LedgerAsset[]
}) {
  const { tokens } = useTheme()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<TripExpense | null>(null)
  const buckets = useMemo(() => expenseBuckets(expenses), [expenses])
  const assetName = useMemo(() => {
    const map = new Map(assets.map((a) => [a.id, a.name]))
    return (id: string) => map.get(id) ?? '—'
  }, [assets])

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  return (
    <View style={styles.stack}>
      <View style={styles.bucketsRow}>
        {buckets.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.muted }]}>No spending yet.</Text>
        ) : (
          buckets.map((b) => (
            <Card key={b.currency} style={styles.bucketCard}>
              <Text style={[styles.bucketLabel, { color: tokens.muted }]}>{b.currency}</Text>
              <Text style={[styles.bucketValue, { color: tokens.ink }]}>
                {formatMoney(b.totalCents, b.currency)}
              </Text>
            </Card>
          ))
        )}
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: tokens.muted }]}>Expenses</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New expense"
          onPress={openNew}
          style={[styles.sectionAdd, { backgroundColor: tokens.accent }]}
        >
          <Text style={{ color: tokens.accentContrast, fontSize: 15, fontWeight: '700' }}>+</Text>
        </Pressable>
      </View>

      {expenses.length === 0 ? (
        <EmptyState title="No expenses" hint="Add your first expense above." />
      ) : (
        expenses.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => {
              setEditing(e)
              setSheetOpen(true)
            }}
          >
            <Card style={styles.expenseRow}>
              <View style={styles.expenseText}>
                <Text style={[styles.expenseDesc, { color: tokens.ink }]} numberOfLines={1}>
                  {e.description}
                </Text>
                <Text style={[styles.expenseMeta, { color: tokens.muted }]}>
                  {assetName(e.assetId)} · {e.spentAt.slice(0, 10)}
                </Text>
              </View>
              <Text style={[styles.expenseAmount, { color: tokens.ink }]}>
                {formatMoney(e.amountCents, e.currencyCode)}
              </Text>
            </Card>
          </Pressable>
        ))
      )}

      {sheetOpen ? (
        <ExpenseSheet
          key={editing ? `${editing.id}:${editing.revision}` : 'new'}
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open)
            if (!open) setEditing(null)
          }}
          householdId={householdId}
          trip={trip}
          assets={assets}
          expense={editing}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 120 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10 },
  backLabel: { fontSize: 13, fontWeight: '600' },
  titleRow: { marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 14 },
  stack: { gap: 16 },
  headerCard: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerCardText: { flex: 1 },
  destination: { fontSize: 15, fontWeight: '600' },
  dates: { fontSize: 13, marginTop: 4 },
  bucketsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emptyText: { fontSize: 13 },
  bucketCard: { paddingHorizontal: 16, paddingVertical: 12 },
  bucketLabel: { fontSize: 11 },
  bucketValue: { fontSize: 17, fontWeight: '700', marginTop: 2 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600' },
  sectionAdd: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 8 },
  expenseText: { flex: 1 },
  expenseDesc: { fontSize: 14, fontWeight: '600' },
  expenseMeta: { fontSize: 11.5, marginTop: 2 },
  expenseAmount: { fontSize: 14, fontWeight: '600' },
})
