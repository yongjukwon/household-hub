import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useTheme } from '@/theme/tokens'
import { NewYearSheet } from './NewYearSheet'
import { StatementYearList } from './StatementYearList'
import { useLedgerYears } from './statements'

/** List-first annual Statements surface. */
export function StatementsTab({ householdId }: { householdId: string }) {
  const { tokens } = useTheme()
  const years = useLedgerYears(householdId)
  const [newYearOpen, setNewYearOpen] = useState(false)

  if (years.isLoading) return <LoadingState />
  if (years.isError) {
    return (
      <ErrorState message="Could not load Ledger years." onRetry={() => void years.refetch()} />
    )
  }

  const rows = years.data ?? []
  return (
    <View>
      <View style={styles.addRow}>
        <Pressable accessibilityRole="button" onPress={() => setNewYearOpen(true)}>
          <Text style={[styles.addLabel, { color: tokens.accent }]}>+ Year</Text>
        </Pressable>
      </View>
      {rows.length === 0 ? (
        <EmptyState
          title="No years yet"
          hint="Create a year to get all 12 monthly budgets."
          action={
            <Pressable
              accessibilityRole="button"
              onPress={() => setNewYearOpen(true)}
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
      <NewYearSheet
        open={newYearOpen}
        onOpenChange={setNewYearOpen}
        householdId={householdId}
        years={rows}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  addRow: { alignItems: 'flex-end', marginBottom: 4 },
  addLabel: { fontSize: 15, fontWeight: '700', paddingVertical: 6 },
  emptyButton: { paddingHorizontal: 16, paddingVertical: 10 },
  emptyButtonText: { fontSize: 14, fontWeight: '600' },
})
