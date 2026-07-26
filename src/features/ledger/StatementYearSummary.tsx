import { LoadingState } from '@/shell/ui/states'

import { StatementCharts } from './StatementCharts'
import { useLedgerYearData } from './statements'

export function StatementYearSummary({
  householdId,
  yearId,
}: {
  householdId: string
  yearId: string
}) {
  const query = useLedgerYearData(householdId, yearId)
  if (query.isLoading) return <LoadingState />
  if (!query.data) {
    return (
      <p className="p-4 text-sm text-[var(--hh-muted)]">
        Could not load this statement.
      </p>
    )
  }
  return <StatementCharts data={query.data} />
}
