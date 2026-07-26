import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { DetailListRow } from '@/components/DetailListRow'
import { ChartBarIcon, ChevronDownIcon } from '@/components/icons'
import { useTheme } from '@/theme/tokens'
import { ClearYearSheet } from './ClearYearSheet'
import { StatementYearSummary } from './StatementYearSummary'
import type { LedgerYear } from './statements'

export function StatementYearList({
  householdId,
  years,
}: {
  householdId: string
  years: LedgerYear[]
}) {
  const { tokens } = useTheme()
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<LedgerYear | null>(null)

  function toggle(yearId: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(yearId)) next.delete(yearId)
      else next.add(yearId)
      return next
    })
  }

  return (
    <View>
      {years.map((year) => {
        const isExpanded = expanded.has(year.id)
        return (
          <View key={year.id} style={[styles.row, { borderBottomColor: tokens.line }]}>
            <DetailListRow
              title={String(year.year)}
              subtitle="12-month statement"
              openLabel={`Open ${year.year} budget`}
              deleteLabel={`Delete ${year.year} statement`}
              onOpen={() =>
                router.push({
                  pathname: '/ledger/[yearId]',
                  params: { yearId: year.id },
                })
              }
              onDelete={() => setDeleting(year)}
              secondaryAction={{
                label: `${isExpanded ? 'Hide' : 'Show'} ${year.year} report`,
                expanded: isExpanded,
                onPress: () => toggle(year.id),
                icon: isExpanded ? (
                  <ChevronDownIcon size={18} color={tokens.ink} />
                ) : (
                  <ChartBarIcon size={18} color={tokens.ink} />
                ),
              }}
            />
            {isExpanded ? (
              <View style={styles.summary}>
                <StatementYearSummary householdId={householdId} yearId={year.id} />
              </View>
            ) : null}
          </View>
        )
      })}
      {deleting ? (
        <ClearYearSheet
          key={deleting.id}
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
          householdId={householdId}
          year={deleting}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  summary: { marginTop: 12 },
})
