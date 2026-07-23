import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DeleteDialog } from '@/components/common/DeleteDialog'
import { RowMenu } from '@/components/common/RowMenu'
import { formatCurrency } from '@/lib/currency'
import {
  useDeleteSavingsTransaction,
  useSavingsTransactions,
  type SavingsSource,
  type SavingsTransaction,
} from '@/hooks/useSavings'
import { TransactionDialog } from './SavingsDialogs'

interface TransactionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: SavingsSource
}

export function TransactionHistoryDialog({
  open,
  onOpenChange,
  source,
}: TransactionHistoryDialogProps) {
  const [editing, setEditing] = useState<SavingsTransaction | null>(null)
  const [deleting, setDeleting] = useState<SavingsTransaction | null>(null)
  const transactionsQuery = useSavingsTransactions(source.id)
  const deleteTransaction = useDeleteSavingsTransaction()
  const transactions = transactionsQuery.data ?? []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{source.name}</DialogTitle>
            <DialogDescription>
              Every deposit and withdrawal behind the current balance of{' '}
              {formatCurrency(source.amount)}.
            </DialogDescription>
          </DialogHeader>
          {transactionsQuery.isPending ? (
            <p role="status" className="py-6 text-center text-sm text-[var(--meta)]">
              Loading history…
            </p>
          ) : transactionsQuery.isError ? (
            <p role="alert" className="py-6 text-center text-sm text-[var(--danger)]">
              Couldn’t load the history — check your connection and try again.
            </p>
          ) : transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--meta)]">
              No transactions yet — the balance is still the starting amount.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line2)]">
              {transactions.map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex items-center gap-3 py-2.5"
                >
                  {transaction.type === 'deposit' ? (
                    <ArrowDownLeft
                      aria-label="Deposit"
                      className="size-4 shrink-0 text-[var(--accent-ink)]"
                    />
                  ) : (
                    <ArrowUpRight
                      aria-label="Withdrawal"
                      className="size-4 shrink-0 text-[var(--danger)]"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm text-[var(--text)]">
                      {transaction.reason ||
                        (transaction.type === 'deposit'
                          ? 'Deposit'
                          : 'Withdrawal')}
                      {transaction.auto_deposit_rule_id && (
                        <Repeat
                          aria-label="Auto-deposit"
                          className="size-3 shrink-0 text-[var(--meta)]"
                        />
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--meta)]">
                      {formatOccurredAt(transaction.occurred_at)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      transaction.type === 'deposit'
                        ? 'text-[var(--text)]'
                        : 'text-[var(--danger)]'
                    }`}
                  >
                    {transaction.type === 'deposit' ? '+' : '−'}
                    {formatCurrency(transaction.amount)}
                  </span>
                  <RowMenu
                    label={`Actions for ${transaction.reason || transaction.type}`}
                    onEdit={() => setEditing(transaction)}
                    onDelete={() => setDeleting(transaction)}
                  />
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      {editing && (
        <TransactionDialog
          key={editing.id}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null)
          }}
          source={source}
          type={editing.type}
          transaction={editing}
        />
      )}
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title="Delete transaction?"
        description={
          deleting
            ? `The ${deleting.type} of ${formatCurrency(deleting.amount)} will be removed and the balance adjusted back.`
            : ''
        }
        onConfirm={async () => {
          if (!deleting) return
          await deleteTransaction.mutateAsync({
            id: deleting.id,
            sourceId: source.id,
          })
        }}
      />
    </>
  )
}

const occurredAtFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatOccurredAt(value: string): string {
  const [y, m, d] = value.split('-').map(Number)
  return occurredAtFormatter.format(new Date(y, m - 1, d))
}
