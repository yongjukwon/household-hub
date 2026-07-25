import { useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import { NewYearSheet } from './NewYearSheet'
import { StatementYearList } from './StatementYearList'
import { useLedgerYears } from './statements'

/** List-first annual Statements surface. */
export function StatementsTab({ householdId }: { householdId: string }) {
  const years = useLedgerYears(householdId)
  const [newYearOpen, setNewYearOpen] = useState(false)

  if (years.isLoading) return <LoadingState />
  if (years.isError) {
    return (
      <ErrorState
        message="Could not load Ledger years."
        onRetry={() => void years.refetch()}
      />
    )
  }

  const rows = years.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setNewYearOpen(true)}
          className="rounded-[var(--hh-radius-control)] px-3 py-2 font-semibold text-[var(--hh-accent)]"
        >
          + Year
        </button>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No years yet"
          hint="Create a year to get all 12 monthly budgets."
          action={
            <button
              type="button"
              onClick={() => setNewYearOpen(true)}
              className="rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2 font-medium text-white"
            >
              Create year
            </button>
          }
        />
      ) : (
        <StatementYearList householdId={householdId} years={rows} />
      )}
      <NewYearSheet
        open={newYearOpen}
        onOpenChange={setNewYearOpen}
        householdId={householdId}
        years={rows}
      />
    </div>
  )
}
