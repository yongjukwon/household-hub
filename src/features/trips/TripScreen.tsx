import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeftIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline'
import { formatMoney } from '@household-hub/domain'
import { Screen } from '@/shell/Screen'
import { EditableTitle } from '@/shell/ui/EditableTitle'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import { useActiveHousehold } from '@/features/household'
import { useLedgerAssets } from '@/features/ledger/assets'
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
} from './data'
import { TripSheet } from './TripSheet'
import { ExpenseSheet } from './ExpenseSheet'
import { ItinerarySheet } from './ItinerarySheet'
import { BookingSheet } from './BookingSheet'
import { ChecklistSheet } from './ChecklistSheet'
import { saveChecklistEntry, saveTrip, toggleChecklistEntry } from './mutations'
import { operationOutcomeError } from '@/lib/operations/outcome'

type TripTab = 'itinerary' | 'bookings' | 'checklist' | 'expenses'

const TABS: { value: TripTab; label: string }[] = [
  { value: 'itinerary', label: 'Itinerary' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'expenses', label: 'Expenses' },
]

/** Trip detail: header + Itinerary/Bookings/Checklist/Expenses tabs. */
export function TripScreen() {
  const { tripId } = useParams<{ tripId: string }>()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const query = useTrip(householdId, tripId)
  const assets = useLedgerAssets(householdId)
  const [tab, setTab] = useState<TripTab>('itinerary')
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
    <Screen
      title={
        trip ? (
          <EditableTitle
            value={trip.name}
            ariaLabel="Trip name"
            onSave={renameTrip}
          />
        ) : (
          'Trip'
        )
      }
    >
      <Link
        to="/trips"
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--hh-muted)]"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        All trips
      </Link>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message="Could not load this trip." onRetry={() => void query.refetch()} />
      ) : !trip ? (
        <EmptyState title="Trip not found" hint="It may have been deleted." />
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]">
            <div>
              <p className="font-medium text-[var(--hh-ink)]">{trip.destination}</p>
              <p className="text-sm text-[var(--hh-muted)]">
                {trip.startDate} – {trip.endDate} · {trip.destinationTimezone}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditTrip(true)}
              aria-label="Edit trip"
              className="text-[var(--hh-muted)]"
            >
              <PencilSquareIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto rounded-[var(--hh-radius-control)] bg-[var(--hh-surface-2)] p-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={tab === t.value}
                onClick={() => setTab(t.value)}
                className={
                  'flex-1 whitespace-nowrap rounded-[calc(var(--hh-radius-control)-4px)] px-3 py-1.5 text-sm font-medium ' +
                  (tab === t.value
                    ? 'bg-[var(--hh-surface)] text-[var(--hh-ink)] shadow-[var(--hh-shadow-card)]'
                    : 'text-[var(--hh-muted)]')
                }
              >
                {t.label}
              </button>
            ))}
          </div>

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
        </div>
      )}

      {householdId && trip && (
        <TripSheet open={editTrip} onOpenChange={setEditTrip} householdId={householdId} trip={trip} />
      )}
    </Screen>
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
  assets: import('@/features/ledger/assets').LedgerAsset[]
}) {
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
    <div className="space-y-4">
      {/* Per-currency totals, never converted or combined. */}
      <div className="flex flex-wrap gap-3">
        {buckets.length === 0 ? (
          <p className="text-sm text-[var(--hh-muted)]">No spending yet.</p>
        ) : (
          buckets.map((b) => (
            <div
              key={b.currency}
              className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] px-4 py-3 shadow-[var(--hh-shadow-card)]"
            >
              <p className="text-xs text-[var(--hh-muted)]">{b.currency}</p>
              <p className="text-lg font-semibold tabular-nums text-[var(--hh-ink)]">
                {formatMoney(b.totalCents, b.currency)}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-[var(--hh-muted)]">Expenses</h3>
        <button
          type="button"
          onClick={openNew}
          aria-label="New expense"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hh-accent)] text-white"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {expenses.length === 0 ? (
        <EmptyState title="No expenses" hint="Add your first expense above." />
      ) : (
        <ul className="space-y-2">
          {expenses.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  setEditing(e)
                  setSheetOpen(true)
                }}
                className="flex w-full items-center justify-between rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 text-left shadow-[var(--hh-shadow-card)]"
              >
                <span>
                  <span className="block font-medium text-[var(--hh-ink)]">{e.description}</span>
                  <span className="block text-xs text-[var(--hh-muted)]">
                    {assetName(e.assetId)} · {e.spentAt.slice(0, 10)}
                    {linkedActivity(e) ? ` · ${linkedActivity(e)}` : ''}
                  </span>
                </span>
                <span className="tabular-nums text-[var(--hh-ink)]">
                  {formatMoney(e.amountCents, e.currencyCode)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {sheetOpen && (
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
      )}
    </div>
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
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
  }, [entries])

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-[var(--hh-muted)]">Itinerary</h3>
        <button
          type="button"
          onClick={openNew}
          aria-label="New itinerary entry"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hh-accent)] text-white"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No itinerary yet" hint="Add your first stop above." />
      ) : (
        <div className="space-y-4">
          {byDate.map(([date, dayEntries]) => (
            <div key={date}>
              <h4 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--hh-muted)]">
                {formatItineraryDate(date)}
              </h4>
              <ul className="space-y-2">
                {dayEntries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(entry)
                        setSheetOpen(true)
                      }}
                      className="flex w-full items-start justify-between gap-3 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 text-left shadow-[var(--hh-shadow-card)]"
                    >
                      <span>
                        <span className="block font-medium text-[var(--hh-ink)]">
                          {entry.title}
                        </span>
                        {entry.notes && (
                          <span className="mt-0.5 block text-xs text-[var(--hh-muted)]">
                            {entry.notes}
                          </span>
                        )}
                      </span>
                      {entry.startTime && (
                        <span className="whitespace-nowrap text-sm tabular-nums text-[var(--hh-muted)]">
                          {entry.startTime}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {sheetOpen && (
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
      )}
    </div>
  )
}

function formatItineraryDate(date: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<BookingEntry | null>(null)

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-[var(--hh-muted)]">Bookings</h3>
        <button
          type="button"
          onClick={openNew}
          aria-label="New booking"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hh-accent)] text-white"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No bookings yet" hint="Add your first booking above." />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => {
                  setEditing(entry)
                  setSheetOpen(true)
                }}
                className="flex w-full items-start justify-between gap-3 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 text-left shadow-[var(--hh-shadow-card)]"
              >
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--hh-muted)]">
                    {BOOKING_KIND_LABELS[entry.kind]}
                  </span>
                  <span className="block font-medium text-[var(--hh-ink)]">{entry.title}</span>
                  {entry.confirmationNumber && (
                    <span className="block text-xs text-[var(--hh-muted)]">
                      Confirmation: {entry.confirmationNumber}
                    </span>
                  )}
                  {entry.address && (
                    <span className="block text-xs text-[var(--hh-muted)]">{entry.address}</span>
                  )}
                </span>
                {entry.startsAt && (
                  <span className="whitespace-nowrap text-sm tabular-nums text-[var(--hh-muted)]">
                    {formatEventTime(entry.startsAt, trip.destinationTimezone)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {sheetOpen && (
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
      )}
    </div>
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
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing] = useState<ChecklistEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const { unchecked, checked } = useMemo(() => sortChecklistEntries(entries), [entries])

  async function addItem() {
    if (newLabel.trim().length === 0) return
    setBusy(true)
    try {
      await saveChecklistEntry(
        householdId,
        {
          id: crypto.randomUUID(),
          tripId: trip.id,
          label: newLabel,
          checked: false,
          sortOrder: entries.length,
        },
        null,
      )
      setNewLabel('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 shadow-[var(--hh-shadow-card)]">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]"
            placeholder="Add a checklist item"
            aria-label="Checklist item label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addItem()
            }}
            disabled={busy}
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="Nothing checked yet" hint="Add your first item above." />
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2">
            {unchecked.map((entry) => (
              <ChecklistRow
                key={entry.id}
                entry={entry}
                householdId={householdId}
                onEdit={() => setEditing(entry)}
              />
            ))}
          </ul>

          {checked.length > 0 && (
            <div>
              <h4 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--hh-muted)]">
                Checked ({checked.length})
              </h4>
              <ul className="space-y-2">
                {checked.map((entry) => (
                  <ChecklistRow
                    key={entry.id}
                    entry={entry}
                    householdId={householdId}
                    onEdit={() => setEditing(entry)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {editing && (
        <ChecklistSheet
          key={`${editing.id}:${editing.revision}`}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          householdId={householdId}
          trip={trip}
          entry={editing}
        />
      )}
    </div>
  )
}

function ChecklistRow({
  entry,
  householdId,
  onEdit,
}: {
  entry: ChecklistEntry
  householdId: string
  onEdit: () => void
}) {
  return (
    <li className="flex items-center gap-3 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 shadow-[var(--hh-shadow-card)]">
      <input
        type="checkbox"
        checked={entry.checked}
        aria-label={`Check ${entry.label}`}
        onChange={(e) => void toggleChecklistEntry(householdId, entry, e.target.checked)}
        className="h-5 w-5 accent-[var(--hh-accent)]"
      />
      <button
        type="button"
        onClick={onEdit}
        className={
          'flex-1 text-left font-medium ' +
          (entry.checked ? 'text-[var(--hh-muted)] line-through' : 'text-[var(--hh-ink)]')
        }
      >
        {entry.label}
      </button>
    </li>
  )
}
