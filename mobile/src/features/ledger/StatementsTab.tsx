import { Pressable, StyleSheet, Text, View } from 'react-native'

import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useTheme } from '@/theme/tokens'
import { StatementYearList } from './StatementYearList'
import { useLedgerYears } from './statements'

/** List-first annual Statements surface. */
export function StatementsTab({
  householdId,
  onCreateYear,
}: {
  householdId: string
  onCreateYear: () => void
}) {
  const { tokens } = useTheme()
  const years = useLedgerYears(householdId)

  if (years.isLoading) return <LoadingState />
  if (years.isError) {
    return (
      <ErrorState message="Could not load Ledger years." onRetry={() => void years.refetch()} />
    )
  }

  const rows = years.data ?? []
  return (
    <View>
      {rows.length === 0 ? (
        <EmptyState
          title="No years yet"
          hint="Create a year to get all 12 monthly budgets."
          action={
            <Pressable
              accessibilityRole="button"
              onPress={onCreateYear}
              style={[styles.emptyButton, { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl }]}
            >
              <Text style={[styles.emptyButtonText, { color: tokens.accentContrast }]}>
                Create year
              </Text>
            </Pressable>
          }
        />
      ) : (
        <StatementYearList householdId={householdId} years={rows} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  emptyButton: { paddingHorizontal: 16, paddingVertical: 10 },
  emptyButtonText: { fontSize: 14, fontWeight: '600' },
})
