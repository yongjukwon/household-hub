import { formatMoney } from '@household-hub/domain'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Card } from '@/components/Card'
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
} from '@/components/icons'
import { EditableTitle } from '@/components/EditableTitle'
import { ListCard } from '@/components/ListCard'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useActiveHousehold } from '@/features/household'
import { useLedgerAssets, type LedgerAsset } from '@/features/ledger/assets'
import { formatEventTime } from '@/features/calendar/datetime'
import {
  expenseBuckets,
  sortChecklistEntries,
  useTrip,
  type BookingEntry,
  type ChecklistEntry,
  type ItineraryEntry,
  type Trip,
  type TripExpense,
} from '@/features/trips/data'
import { ExpenseSheet } from '@/features/trips/ExpenseSheet'
import { ItinerarySheet } from '@/features/trips/ItinerarySheet'
import { BookingSheet } from '@/features/trips/BookingSheet'
import { ChecklistSheet } from '@/features/trips/ChecklistSheet'
import { TripSheet } from '@/features/trips/TripSheet'
import { saveChecklistEntry, saveTrip, toggleChecklistEntry } from '@/features/trips/mutations'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { newUuid } from '@/lib/uuid'
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
  const { tripId } = useLocalSearchParams<{ tripId: string }>()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const query = useTrip(householdId, tripId)
  const assets = useLedgerAssets(householdId)
  const [tab, setTab] = useState<TripTab>('itinerary')
  const [editTrip, setEditTrip] = useState(false)

  const trip = query.data?.trip ?? null

  async function renameTrip(next: string): Promise<string | null> {
    if (!householdId || !trip) return 'The trip is not available.'
    try {
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
    } catch (failure) {
      return operationThrownError(failure, 'Could not rename this trip.')
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
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

            {tab === 'itinerary' && householdId ? (
              <ItineraryTab
                householdId={householdId}
                trip={trip}
                entries={query.data?.itinerary ?? []}
              />
            ) : tab === 'bookings' && householdId ? (
              <BookingsTab
                householdId={householdId}
                trip={trip}
                entries={query.data?.bookings ?? []}
              />
            ) : tab === 'checklist' && householdId ? (
              <ChecklistTab
                householdId={householdId}
                trip={trip}
                entries={query.data?.checklist ?? []}
              />
            ) : tab === 'expenses' && householdId ? (
              <ExpensesTab
                householdId={householdId}
                trip={trip}
                expenses={query.data?.expenses ?? []}
                itinerary={query.data?.itinerary ?? []}
                bookings={query.data?.bookings ?? []}
                assets={assets.data ?? []}
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

function ItineraryTab({
  householdId,
  trip,
  entries,
}: {
  householdId: string
  trip: Trip
  entries: ItineraryEntry[]
}) {
  const { tokens } = useTheme()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ItineraryEntry | null>(null)

  const byDate = useMemo(() => {
    const groups = new Map<string, ItineraryEntry[]>()
    for (const entry of entries) {
      const list = groups.get(entry.itemDate) ?? []
      list.push(entry)
      groups.set(entry.itemDate, list)
    }
    for (const list of groups.values()) {
      list.sort(
        (left, right) =>
          (left.startTime ?? '').localeCompare(right.startTime ?? '') ||
          left.sortOrder - right.sortOrder,
      )
    }
    return [...groups.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )
  }, [entries])

  return (
    <View style={styles.stack}>
      <SectionHeading
        title="Itinerary"
        actionLabel="New itinerary entry"
        onAction={() => {
          setEditing(null)
          setSheetOpen(true)
        }}
      />

      {entries.length === 0 ? (
        <EmptyState title="No itinerary yet" hint="Add your first stop above." />
      ) : (
        byDate.map(([date, dayEntries]) => (
          <View key={date} style={styles.group}>
            <Text style={[styles.groupTitle, { color: tokens.muted }]}>
              {formatItineraryDate(date)}
            </Text>
            {dayEntries.map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => {
                  setEditing(entry)
                  setSheetOpen(true)
                }}
              >
                <ListCard style={styles.contentRow}>
                  <View style={styles.contentRowText}>
                    <Text style={[styles.contentTitle, { color: tokens.ink }]}>
                      {entry.title}
                    </Text>
                    {entry.notes ? (
                      <Text
                        style={[styles.contentMeta, { color: tokens.muted }]}
                        numberOfLines={2}
                      >
                        {entry.notes}
                      </Text>
                    ) : null}
                  </View>
                  {entry.startTime ? (
                    <Text style={[styles.contentTime, { color: tokens.muted }]}>
                      {entry.startTime}
                    </Text>
                  ) : null}
                </ListCard>
              </Pressable>
            ))}
          </View>
        ))
      )}

      {sheetOpen ? (
        <ItinerarySheet
          key={editing ? `${editing.id}:${editing.revision}` : 'new'}
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open)
            if (!open) setEditing(null)
          }}
          householdId={householdId}
          trip={trip}
          entry={editing}
          sortOrder={entries.length}
        />
      ) : null}
    </View>
  )
}

function formatItineraryDate(date: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

const BOOKING_KIND_LABELS: Record<BookingEntry['kind'], string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  car: 'Car',
  other: 'Other',
}

function BookingsTab({
  householdId,
  trip,
  entries,
}: {
  householdId: string
  trip: Trip
  entries: BookingEntry[]
}) {
  const { tokens } = useTheme()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<BookingEntry | null>(null)

  return (
    <View style={styles.stack}>
      <SectionHeading
        title="Bookings"
        actionLabel="New booking"
        onAction={() => {
          setEditing(null)
          setSheetOpen(true)
        }}
      />

      {entries.length === 0 ? (
        <EmptyState title="No bookings yet" hint="Add your first booking above." />
      ) : (
        entries.map((entry) => (
          <Pressable
            key={entry.id}
            onPress={() => {
              setEditing(entry)
              setSheetOpen(true)
            }}
          >
            <ListCard style={styles.contentRow}>
              <View style={styles.contentRowText}>
                <Text style={[styles.eyebrow, { color: tokens.muted }]}>
                  {BOOKING_KIND_LABELS[entry.kind]}
                </Text>
                <Text style={[styles.contentTitle, { color: tokens.ink }]}>
                  {entry.title}
                </Text>
                {entry.confirmationNumber ? (
                  <Text style={[styles.contentMeta, { color: tokens.muted }]}>
                    Confirmation: {entry.confirmationNumber}
                  </Text>
                ) : null}
                {entry.address ? (
                  <Text
                    style={[styles.contentMeta, { color: tokens.muted }]}
                    numberOfLines={2}
                  >
                    {entry.address}
                  </Text>
                ) : null}
              </View>
              {entry.startsAt ? (
                <Text style={[styles.contentTime, { color: tokens.muted }]}>
                  {formatEventTime(entry.startsAt, trip.destinationTimezone)}
                </Text>
              ) : null}
            </ListCard>
          </Pressable>
        ))
      )}

      {sheetOpen ? (
        <BookingSheet
          key={editing ? `${editing.id}:${editing.revision}` : 'new'}
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open)
            if (!open) setEditing(null)
          }}
          householdId={householdId}
          trip={trip}
          entry={editing}
          sortOrder={entries.length}
        />
      ) : null}
    </View>
  )
}

function ChecklistTab({
  householdId,
  trip,
  entries,
}: {
  householdId: string
  trip: Trip
  entries: ChecklistEntry[]
}) {
  const { tokens } = useTheme()
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing] = useState<ChecklistEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { unchecked, checked } = useMemo(
    () => sortChecklistEntries(entries),
    [entries],
  )

  async function addItem() {
    if (newLabel.trim().length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const outcome = await saveChecklistEntry(
        householdId,
        {
          id: newUuid(),
          tripId: trip.id,
          label: newLabel,
          checked: false,
          sortOrder: entries.length,
        },
        null,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      setNewLabel('')
    } catch (failure) {
      setError(
        operationThrownError(failure, 'Could not add this checklist item.'),
      )
    } finally {
      setBusy(false)
    }
  }

  async function toggleItem(entry: ChecklistEntry) {
    setError(null)
    try {
      const outcome = await toggleChecklistEntry(
        householdId,
        entry,
        !entry.checked,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) setError(outcomeError)
    } catch (failure) {
      setError(
        operationThrownError(failure, 'Could not update this checklist item.'),
      )
    }
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.checklistComposer}>
        <TextInput
          accessibilityLabel="Checklist item label"
          placeholder="Add a checklist item"
          placeholderTextColor={tokens.muted3}
          value={newLabel}
          onChangeText={setNewLabel}
          onSubmitEditing={() => void addItem()}
          editable={!busy}
          style={[
            styles.checklistInput,
            {
              borderColor: tokens.line,
              borderRadius: tokens.radiusControl,
              color: tokens.ink,
            },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add checklist item"
          disabled={busy || newLabel.trim().length === 0}
          onPress={() => void addItem()}
          style={[
            styles.checklistAdd,
            { backgroundColor: tokens.accent },
            (busy || newLabel.trim().length === 0) && styles.disabled,
          ]}
        >
          <PlusIcon size={17} color={tokens.accentContrast} />
        </Pressable>
      </Card>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.errorText, { color: tokens.danger }]}>
          {error}
        </Text>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState title="Nothing checked yet" hint="Add your first item above." />
      ) : (
        <>
          {unchecked.map((entry) => (
            <ChecklistRow
              key={entry.id}
              entry={entry}
              onToggle={() => void toggleItem(entry)}
              onEdit={() => setEditing(entry)}
            />
          ))}
          {checked.length > 0 ? (
            <View style={styles.group}>
              <Text style={[styles.groupTitle, { color: tokens.muted }]}>
                Checked ({checked.length})
              </Text>
              {checked.map((entry) => (
                <ChecklistRow
                  key={entry.id}
                  entry={entry}
                  onToggle={() => void toggleItem(entry)}
                  onEdit={() => setEditing(entry)}
                />
              ))}
            </View>
          ) : null}
        </>
      )}

      {editing ? (
        <ChecklistSheet
          key={`${editing.id}:${editing.revision}`}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          householdId={householdId}
          trip={trip}
          entry={editing}
        />
      ) : null}
    </View>
  )
}

function ChecklistRow({
  entry,
  onToggle,
  onEdit,
}: {
  entry: ChecklistEntry
  onToggle: () => void
  onEdit: () => void
}) {
  const { tokens } = useTheme()
  return (
    <ListCard style={styles.checklistRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Check ${entry.label}`}
        accessibilityState={{ checked: entry.checked }}
        onPress={onToggle}
        style={[
          styles.checkbox,
          {
            borderColor: entry.checked ? tokens.accent : tokens.muted3,
            backgroundColor: entry.checked ? tokens.accent : 'transparent',
          },
        ]}
      >
        {entry.checked ? (
          <CheckIcon size={14} color={tokens.accentContrast} strokeWidth={2.5} />
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onEdit}
        style={styles.checklistLabelButton}
      >
        <Text
          style={[
            styles.contentTitle,
            { color: entry.checked ? tokens.muted : tokens.ink },
            entry.checked && styles.checkedLabel,
          ]}
        >
          {entry.label}
        </Text>
      </Pressable>
    </ListCard>
  )
}

function SectionHeading({
  title,
  actionLabel,
  onAction,
}: {
  title: string
  actionLabel: string
  onAction: () => void
}) {
  const { tokens } = useTheme()
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionTitle, { color: tokens.muted }]}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onAction}
        style={[styles.sectionAdd, { backgroundColor: tokens.accent }]}
      >
        <PlusIcon size={15} color={tokens.accentContrast} strokeWidth={2} />
      </Pressable>
    </View>
  )
}

function ExpensesTab({
  householdId,
  trip,
  expenses,
  itinerary,
  bookings,
  assets,
}: {
  householdId: string
  trip: Trip
  expenses: TripExpense[]
  itinerary: ItineraryEntry[]
  bookings: BookingEntry[]
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
  const linkedActivity = useMemo(() => {
    const map = new Map<string, string>()
    itinerary.forEach((entry) => map.set(`itinerary:${entry.id}`, entry.title))
    bookings.forEach((entry) => map.set(`booking:${entry.id}`, entry.title))
    return (expense: TripExpense) => {
      if (expense.itineraryEntryId) {
        return map.get(`itinerary:${expense.itineraryEntryId}`) ?? 'Itinerary activity'
      }
      if (expense.bookingEntryId) {
        return map.get(`booking:${expense.bookingEntryId}`) ?? 'Booking'
      }
      return null
    }
  }, [bookings, itinerary])

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
            <ListCard style={styles.expenseRow}>
              <View style={styles.expenseText}>
                <Text style={[styles.expenseDesc, { color: tokens.ink }]} numberOfLines={1}>
                  {e.description}
                </Text>
                <Text style={[styles.expenseMeta, { color: tokens.muted }]}>
                  {assetName(e.assetId)} · {e.spentAt.slice(0, 10)}
                  {linkedActivity(e) ? ` · ${linkedActivity(e)}` : ''}
                </Text>
              </View>
              <Text style={[styles.expenseAmount, { color: tokens.ink }]}>
                {formatMoney(e.amountCents, e.currencyCode)}
              </Text>
            </ListCard>
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
          itinerary={itinerary}
          bookings={bookings}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 24 },
  titleRow: { marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 14 },
  stack: { gap: 16 },
  group: { gap: 8 },
  groupTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 2,
  },
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
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
  },
  contentRowText: { flex: 1 },
  contentTitle: { fontSize: 14, fontWeight: '600' },
  contentMeta: { fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  contentTime: { fontSize: 12, fontVariant: ['tabular-nums'] },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  checklistComposer: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  checklistAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistLabelButton: { flex: 1, paddingVertical: 2 },
  checkedLabel: { textDecorationLine: 'line-through' },
  disabled: { opacity: 0.55 },
  errorText: { fontSize: 13 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 8 },
  expenseText: { flex: 1 },
  expenseDesc: { fontSize: 14, fontWeight: '600' },
  expenseMeta: { fontSize: 11.5, marginTop: 2 },
  expenseAmount: { fontSize: 14, fontWeight: '600' },
})
