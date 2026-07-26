import { Text } from 'react-native'

import { LoadingState } from '@/components/states'
import { useTheme } from '@/theme/tokens'
import { StatementCharts } from './StatementCharts'
import { useLedgerYearData } from './statements'

export function StatementYearSummary({
  householdId,
  yearId,
}: {
  householdId: string
  yearId: string
}) {
  const { tokens } = useTheme()
  const query = useLedgerYearData(householdId, yearId)
  if (query.isLoading) return <LoadingState />
  if (!query.data) {
    return (
      <Text style={{ color: tokens.muted, fontSize: 13, padding: 16 }}>
        Could not load this statement.
      </Text>
    )
  }
  return <StatementCharts data={query.data} showMonthlyLimits />
}
