import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import { HOUSEHOLD_CURRENCY, type LedgerAsset } from '@/features/ledger/assets'
import type { Trip, TripExpense } from './data'
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
}: ExpenseSheetProps) {
  const currencyChoices = Array.from(
    new Set([trip.destinationCurrency, HOUSEHOLD_CURRENCY]),
  )
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(centsToInputValue(expense?.amountCents ?? null))
  const [currency, setCurrency] = useState(expense?.currencyCode ?? trip.destinationCurrency)
  const [assetId, setAssetId] = useState(expense?.assetId ?? assets[0]?.id ?? '')
  const [date, setDate] = useState(
    (expense?.spentAt ?? trip.startDate + 'T12:00:00Z').slice(0, 10),
  )
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const cents = parseDollarsToCents(amount)
    if (!assetId || !cents || cents <= 0 || description.trim().length === 0) {
      setError('Pick an asset, a positive amount, and a description.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveExpense(
        householdId,
        {
          id: expense?.id ?? crypto.randomUUID(),
          tripId: trip.id,
          assetId,
          amountCents: cents,
          currency,
          spentAt: new Date(`${date}T12:00:00Z`).toISOString(),
          description,
        },
        expense?.revision ?? null,
      )
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!expense) return
    setSaving(true)
    try {
      await deleteExpense(householdId, expense.id, expense.revision)
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
              onChange={(e) => setCurrency(e.target.value)}
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
            {assets.length === 0 && <option value="">No assets yet</option>}
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
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
        {error && <p className="text-sm text-[var(--hh-danger)]">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={saving || assets.length === 0}
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
