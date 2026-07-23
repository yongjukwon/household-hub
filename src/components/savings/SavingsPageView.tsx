import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteDialog } from '@/components/common/DeleteDialog'
import { formatCurrency } from '@/lib/currency'
import { useHousehold } from '@/hooks/useHousehold'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import {
  savingsKeys,
  useCatchUpAutoDeposits,
  useDeleteSavingsSource,
  useSavingsDepositRules,
  useSavingsSources,
  type SavingsSource,
  type SavingsTransactionType,
} from '@/hooks/useSavings'
import { SourceCard } from './SourceCard'
import {
  AutoDepositRuleDialog,
  SourceDialog,
  TransactionDialog,
} from './SavingsDialogs'
import { TransactionHistoryDialog } from './TransactionHistoryDialog'

const EMPTY_SOURCES: SavingsSource[] = []

export function SavingsPageView() {
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
  const [renamingSource, setRenamingSource] = useState<SavingsSource | null>(
    null,
  )
  const [transactionTarget, setTransactionTarget] = useState<{
    source: SavingsSource
    type: SavingsTransactionType
  } | null>(null)
  const [historySource, setHistorySource] = useState<SavingsSource | null>(null)
  const [autoDepositSource, setAutoDepositSource] =
    useState<SavingsSource | null>(null)
  const [deletingSource, setDeletingSource] = useState<SavingsSource | null>(
    null,
  )

  const { data: household } = useHousehold()
  const sourcesQuery = useSavingsSources()
  const deleteSource = useDeleteSavingsSource()
  // Log any semi-monthly auto-deposits that came due since the last visit.
  useCatchUpAutoDeposits()

  useRealtimeTable(
    'savings_sources',
    'household_id',
    household?.id ?? '',
    savingsKeys.sources(),
  )
  // Prefix keys: a remote transaction/rule change may touch any source.
  useRealtimeTable(
    'savings_transactions',
    'household_id',
    household?.id ?? '',
    ['savings', 'transactions'],
  )
  useRealtimeTable('savings_deposit_rules', 'household_id', household?.id ?? '', [
    'savings',
    'rules',
  ])

  const sources = sourcesQuery.data ?? EMPTY_SOURCES
  const totalAmount = sources.reduce((sum, source) => sum + source.amount, 0)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
          Savings
        </h1>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSourceDialogOpen(true)}
        >
          <Plus data-icon="inline-start" />
          New source
        </Button>
      </header>

      {sources.length > 0 && (
        <div className="mt-6 border-b border-[var(--line)] pb-6">
          <p className="eyebrow">Total balance</p>
          <p className="mt-1.5 text-[40px] leading-none font-bold tracking-tight text-[var(--text)]">
            {formatCurrency(totalAmount)}
          </p>
          <p className="mt-2.5 text-sm text-[var(--meta)]">
            across{' '}
            {sources.length === 1 ? '1 source' : `${sources.length} sources`}
          </p>
        </div>
      )}

      {sourcesQuery.isPending ? (
        <p
          role="status"
          className="mt-16 text-center text-sm text-[var(--meta)]"
        >
          Loading savings…
        </p>
      ) : sourcesQuery.isError ? (
        <div className="mt-12 text-center">
          <p role="alert" className="text-sm text-[var(--danger)]">
            Couldn’t load your savings — check your connection and try again.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void sourcesQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : sources.length === 0 ? (
        <section className="mt-16 text-center" aria-labelledby="empty-savings">
          <h2 id="empty-savings" className="font-semibold text-[var(--text)]">
            Track where your savings live
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--meta)]">
            Add a source — an account, a fund, cash — and every deposit and
            withdrawal keeps its balance up to date.
          </p>
          <Button
            type="button"
            className="mt-5"
            onClick={() => setSourceDialogOpen(true)}
          >
            <Plus data-icon="inline-start" />
            New source
          </Button>
        </section>
      ) : (
        <div className="mt-5 space-y-3">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onDeposit={() =>
                setTransactionTarget({ source, type: 'deposit' })
              }
              onWithdraw={() =>
                setTransactionTarget({ source, type: 'withdrawal' })
              }
              onHistory={() => setHistorySource(source)}
              onAutoDeposit={() => setAutoDepositSource(source)}
              onRename={() => setRenamingSource(source)}
              onDelete={() => setDeletingSource(source)}
            />
          ))}
        </div>
      )}

      {(sourceDialogOpen || renamingSource) && household && (
        <SourceDialog
          key={renamingSource?.id ?? 'new-source'}
          open
          onOpenChange={(next) => {
            if (!next) {
              setSourceDialogOpen(false)
              setRenamingSource(null)
            }
          }}
          householdId={household.id}
          source={renamingSource}
        />
      )}
      {transactionTarget && (
        <TransactionDialog
          key={`${transactionTarget.source.id}-${transactionTarget.type}`}
          open
          onOpenChange={(next) => {
            if (!next) setTransactionTarget(null)
          }}
          source={transactionTarget.source}
          type={transactionTarget.type}
          transaction={null}
        />
      )}
      {historySource && (
        <TransactionHistoryDialog
          key={historySource.id}
          open
          onOpenChange={(next) => {
            if (!next) setHistorySource(null)
          }}
          source={historySource}
        />
      )}
      {autoDepositSource && (
        <AutoDepositRuleLoader
          source={autoDepositSource}
          onClose={() => setAutoDepositSource(null)}
        />
      )}
      <DeleteDialog
        open={!!deletingSource}
        onOpenChange={(next) => {
          if (!next) setDeletingSource(null)
        }}
        title="Delete source?"
        description={
          deletingSource
            ? `“${deletingSource.name}” and its entire deposit/withdrawal history and auto-deposit rule will be permanently deleted.`
            : ''
        }
        onConfirm={async () => {
          if (!deletingSource) return
          await deleteSource.mutateAsync(deletingSource.id)
        }}
      />
    </div>
  )
}

// The rule being edited lives in a per-source query (usually already cached by
// the card); gate the dialog on it resolving so its initial form state is the
// real rule, not a flash of empty defaults.
function AutoDepositRuleLoader({
  source,
  onClose,
}: {
  source: SavingsSource
  onClose: () => void
}) {
  const rulesQuery = useSavingsDepositRules(source.id)
  if (rulesQuery.isPending) return null
  const rule = rulesQuery.data?.[0] ?? null
  return (
    <AutoDepositRuleDialog
      key={rule?.id ?? 'new-rule'}
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      source={source}
      rule={rule}
    />
  )
}
