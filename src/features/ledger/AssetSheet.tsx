import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import { HOUSEHOLD_CURRENCY, type AssetKind, type LedgerAsset } from './assets'
import { deleteAsset, saveAsset } from './assetMutations'

const KINDS: { value: AssetKind; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
]

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const label = 'block text-sm font-medium text-[var(--hh-muted)]'

interface AssetSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  asset: LedgerAsset | null
  sortOrder: number
}

/** Create or edit an asset (name, kind, currency, current balance). */
export function AssetSheet({
  open,
  onOpenChange,
  householdId,
  asset,
  sortOrder,
}: AssetSheetProps) {
  const [name, setName] = useState(asset?.name ?? '')
  const [kind, setKind] = useState<AssetKind>(asset?.kind ?? 'checking')
  const [currency, setCurrency] = useState(asset?.currencyCode ?? HOUSEHOLD_CURRENCY)
  const [balance, setBalance] = useState(centsToInputValue(asset?.balanceCents ?? 0))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const currencyLocked = !!asset

  async function handleSave() {
    if (name.trim().length === 0) return
    setSaving(true)
    try {
      await saveAsset(
        householdId,
        {
          id: asset?.id ?? crypto.randomUUID(),
          name,
          kind,
          currency: currency.trim().toUpperCase() || HOUSEHOLD_CURRENCY,
          balanceCents: parseDollarsToCents(balance) ?? 0,
          sortOrder,
        },
        asset?.revision ?? null,
      )
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!asset) return
    setSaving(true)
    try {
      await deleteAsset(householdId, asset.id, asset.revision)
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
      title={asset ? 'Edit asset' : 'New asset'}
    >
      <div className="space-y-3">
        <div>
          <label className={label} htmlFor="asset-name">
            Name
          </label>
          <input
            id="asset-name"
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="asset-kind">
              Type
            </label>
            <select
              id="asset-kind"
              className={field}
              value={kind}
              onChange={(e) => setKind(e.target.value as AssetKind)}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="asset-currency">
              Currency
            </label>
            <input
              id="asset-currency"
              className={field}
              value={currency}
              maxLength={3}
              disabled={currencyLocked}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="asset-balance">
            Current balance
          </label>
          <input
            id="asset-balance"
            className={field}
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1 rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            Save
          </button>
          {asset && (
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
        title="Delete asset?"
        description="This removes the asset and its postings. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}
