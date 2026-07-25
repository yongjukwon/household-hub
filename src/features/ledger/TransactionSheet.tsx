import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { parseDollarsToCents } from '@/features/moneyInput'
import { centsToInputValue } from '@/features/moneyInput'
import { operationOutcomeError } from '@/lib/operations/outcome'
import type { LedgerAsset } from './assets'
import type {
  CategoryKind,
  LedgerTransaction,
  MonthCategory,
} from './statements'
import { saveTransaction } from './statementMutations'

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const label = 'block text-sm font-medium text-[var(--hh-muted)]'

/** Add a transaction to a specific year/month. */
export function TransactionSheet({
  open,
  onOpenChange,
  householdId,
  yearId,
  month,
  kind,
  categories,
  assets,
  transaction = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  yearId: string
  month: number
  kind: CategoryKind
  categories: MonthCategory[]
  assets: LedgerAsset[]
  transaction?: LedgerTransaction | null
}) {
  const initialCategory = categories.find(
    (category) =>
      category.kind === kind &&
      category.categoryId === transaction?.categoryId,
  )
  const [categoryId, setCategoryId] = useState(initialCategory?.id ?? '')
  const [assetId, setAssetId] = useState(
    transaction?.assetId ?? assets[0]?.id ?? '',
  )
  const [amount, setAmount] = useState(
    centsToInputValue(transaction?.amountCents),
  )
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [date, setDate] = useState(
    transaction?.occurredAt.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kindCategories = categories.filter((c) => c.kind === kind)
  const effectiveCategory = categoryId || kindCategories[0]?.id || ''

  async function handleSave() {
    const cents = parseDollarsToCents(amount)
    const category = kindCategories.find((c) => c.id === effectiveCategory)
    if (!category || !assetId || !cents || cents <= 0 || description.trim().length === 0) {
      setError('Pick a category and asset, a positive amount, and a description.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await saveTransaction(
        householdId,
        {
          id: transaction?.id ?? crypto.randomUUID(),
          yearId,
          month,
          categoryId: category.categoryId,
          assetId,
          kind,
          amountCents: cents,
          occurredAt: new Date(`${date}T12:00:00Z`).toISOString(),
          description,
        },
        transaction?.revision ?? null,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      setAmount('')
      setDescription('')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${transaction ? 'Edit' : 'New'} ${kind}`}
    >
      <div className="space-y-3">
        <div>
          <label className={label} htmlFor="tx-category">
            Category
          </label>
          <select
            id="tx-category"
            className={field}
            value={effectiveCategory}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {kindCategories.length === 0 && <option value="">No categories yet</option>}
            {kindCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="tx-asset">
              Asset
            </label>
            <select
              id="tx-asset"
              className={field}
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="tx-amount">
              Amount
            </label>
            <input
              id="tx-amount"
              className={field}
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="tx-desc">
            Description
          </label>
          <input
            id="tx-desc"
            className={field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="tx-date">
            Date
          </label>
          <input
            id="tx-date"
            type="date"
            className={field}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-[var(--hh-danger)]">{error}</p>}
        <button
          type="button"
          disabled={saving || assets.length === 0}
          onClick={() => void handleSave()}
          className="w-full rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </BottomSheet>
  )
}
