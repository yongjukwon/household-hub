import { useState } from 'react'
import { formatMoney } from '@household-hub/domain'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { operationOutcomeError } from '@/lib/operations/outcome'
import { HOUSEHOLD_CURRENCY, type LedgerAsset } from './assets'
import type { LedgerTransaction, MonthCategory } from './statements'
import { deleteTransaction } from './statementMutations'

export function TransactionList({
  householdId,
  transactions,
  categories,
  assets,
  onEdit,
}: {
  householdId: string
  transactions: LedgerTransaction[]
  categories: MonthCategory[]
  assets: LedgerAsset[]
  onEdit: (transaction: LedgerTransaction) => void
}) {
  const [deleting, setDeleting] = useState<LedgerTransaction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const categoryById = new Map(categories.map((entry) => [entry.categoryId, entry.name]))
  const assetById = new Map(assets.map((entry) => [entry.id, entry.name]))

  async function handleDelete() {
    if (!deleting) return
    const outcome = await deleteTransaction(
      householdId,
      deleting.id,
      deleting.revision,
    )
    const outcomeError = operationOutcomeError(outcome)
    if (outcomeError) {
      setError(outcomeError)
      return
    }
    setDeleting(null)
  }

  if (transactions.length === 0) {
    return <p className="py-3 text-sm text-[var(--hh-muted)]">No transactions yet.</p>
  }

  return (
    <>
      {error && <p className="mb-2 text-sm text-[var(--hh-danger)]">{error}</p>}
      <ul className="space-y-2">
        {transactions.map((transaction) => (
          <li
            key={transaction.id}
            className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 shadow-[var(--hh-shadow-card)]"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onEdit(transaction)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate font-semibold text-[var(--hh-ink)]">
                  {transaction.description}
                </span>
                <span className="block text-xs text-[var(--hh-muted)]">
                  {categoryById.get(transaction.categoryId) ?? 'Category'} ·{' '}
                  {assetById.get(transaction.assetId) ?? 'Asset'} ·{' '}
                  {new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(
                    new Date(transaction.occurredAt),
                  )}
                </span>
              </button>
              <div className="text-right">
                <p className="font-semibold tabular-nums text-[var(--hh-ink)]">
                  {transaction.kind === 'spending' ? '−' : '+'}
                  {formatMoney(transaction.amountCents, HOUSEHOLD_CURRENCY)}
                </p>
                <button
                  type="button"
                  onClick={() => setDeleting(transaction)}
                  className="mt-1 text-xs font-medium text-[var(--hh-danger)]"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete transaction?"
        description="The linked Asset posting will be reversed."
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
