import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeftIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline'
import { formatMoney } from '@household-hub/domain'
import { Screen } from '@/shell/Screen'
import { EditableTitle } from '@/shell/ui/EditableTitle'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import { useActiveHousehold } from '@/features/household'
import { useLedgerAssets } from '@/features/ledger/assets'
import { expenseBuckets, useTrip, type Trip, type TripExpense } from './data'
import { TripSheet } from './TripSheet'
import { ExpenseSheet } from './ExpenseSheet'
import { saveTrip } from './mutations'
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
  assets,
}: {
  householdId: string
  trip: Trip
  expenses: TripExpense[]
  assets: import('@/features/ledger/assets').LedgerAsset[]
}) {
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
        />
      )}
    </div>
  )
}
