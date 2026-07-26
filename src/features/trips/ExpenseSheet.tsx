import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import { HOUSEHOLD_CURRENCY, type LedgerAsset } from '@/features/ledger/assets'
import { operationOutcomeError } from '@/lib/operations/outcome'
import type {
  BookingEntry,
  ItineraryEntry,
  Trip,
  TripExpense,
} from './data'
import {
  compatibleExpenseAssets,
  expenseLinkValue,
  parseExpenseLink,
} from './forms'
import { deleteExpense, saveExpense } from './mutations'

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const label = 'block text-sm font-medium text-[var(--hh-muted)]'

interface ExpenseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  trip: Trip
  assets: LedgerAsset[]
  expense: TripExpense | null
  itinerary: ItineraryEntry[]
  bookings: BookingEntry[]
}

/**
 * Add/edit a trip expense. Currency defaults to the trip's destination
 * currency but can be the household currency (CAD) for at-home spending; the
 * server links a CAD expense into the Ledger and debits the chosen asset.
 */
export function ExpenseSheet({
  open,
  onOpenChange,
  householdId,
  trip,
  assets,
  expense,
  itinerary,
  bookings,
}: ExpenseSheetProps) {
  const currencyChoices = Array.from(
    new Set([trip.destinationCurrency.toUpperCase(), HOUSEHOLD_CURRENCY]),
  )
  const initialCurrency =
    expense?.currencyCode.toUpperCase() ?? trip.destinationCurrency.toUpperCase()
  const initialAssets = compatibleExpenseAssets(assets, initialCurrency)
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(centsToInputValue(expense?.amountCents ?? null))
  const [currency, setCurrency] = useState(initialCurrency)
  const [assetId, setAssetId] = useState(
    initialAssets.some((asset) => asset.id === expense?.assetId)
      ? expense!.assetId
      : initialAssets[0]?.id ?? '',
  )
  const [date, setDate] = useState(
    (expense?.spentAt ?? trip.startDate + 'T12:00:00Z').slice(0, 10),
  )
  const [link, setLink] = useState(
    expenseLinkValue({
      itineraryEntryId: expense?.itineraryEntryId ?? null,
      bookingEntryId: expense?.bookingEntryId ?? null,
    }),
  )
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const compatibleAssets = compatibleExpenseAssets(assets, currency)

  async function handleSave() {
    const cents = parseDollarsToCents(amount)
    if (
      !compatibleAssets.some((asset) => asset.id === assetId) ||
      !cents ||
      cents <= 0 ||
      description.trim().length === 0
    ) {
      setError('Pick an asset, a positive amount, and a description.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const linkIds = parseExpenseLink(link)
      const outcome = await saveExpense(
        householdId,
        {
          id: expense?.id ?? crypto.randomUUID(),
          tripId: trip.id,
          assetId,
          amountCents: cents,
          currency,
          spentAt: new Date(`${date}T12:00:00Z`).toISOString(),
          description,
          ...linkIds,
        },
        expense?.revision ?? null,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!expense) return
    setSaving(true)
    try {
      const outcome = await deleteExpense(householdId, expense.id, expense.revision)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        setConfirmDelete(false)
        return
      }
      setConfirmDelete(false)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={expense ? 'Edit expense' : 'New expense'}
    >
      <div className="space-y-3">
        <div>
          <label className={label} htmlFor="exp-desc">
            Description
          </label>
          <input
            id="exp-desc"
            className={field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="exp-amount">
              Amount
            </label>
            <input
              id="exp-amount"
              className={field}
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="exp-currency">
              Currency
            </label>
            <select
              id="exp-currency"
              className={field}
              value={currency}
              onChange={(e) => {
                const next = e.target.value
                setCurrency(next)
                setAssetId(compatibleExpenseAssets(assets, next)[0]?.id ?? '')
              }}
            >
              {currencyChoices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={label} htmlFor="exp-asset">
            Paid from
          </label>
          <select
            id="exp-asset"
            className={field}
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          >
            {compatibleAssets.length === 0 && (
              <option value="">No matching assets</option>
            )}
            {compatibleAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {compatibleAssets.length === 0 && (
            <p className="mt-2 text-sm text-[var(--hh-muted)]">
              No {currency} Asset is available.{' '}
              <Link
                to="/ledger?segment=assets"
                className="font-semibold text-[var(--hh-accent)]"
              >
                Add a {currency} Asset
              </Link>
            </p>
          )}
        </div>
        <div>
          <label className={label} htmlFor="exp-date">
            Date
          </label>
          <input
            id="exp-date"
            type="date"
            className={field}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="exp-link">
            Linked activity (optional)
          </label>
          <select
            id="exp-link"
            className={field}
            value={link}
            onChange={(event) => setLink(event.target.value)}
          >
            <option value="standalone">Standalone expense</option>
            {itinerary.map((entry) => (
              <option key={entry.id} value={`itinerary:${entry.id}`}>
                Itinerary · {entry.title}
              </option>
            ))}
            {bookings.map((entry) => (
              <option key={entry.id} value={`booking:${entry.id}`}>
                Booking · {entry.title}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-[var(--hh-danger)]">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
          disabled={saving || compatibleAssets.length === 0}
            onClick={() => void handleSave()}
            className="flex-1 rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            Save
          </button>
          {expense && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmDelete(true)}
              className="rounded-[var(--hh-radius-control)] px-4 py-2.5 font-medium text-[var(--hh-danger)]"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete expense?"
        description="This removes the expense and reverses its asset debit."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}
