import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ChevronDownIcon, ChevronRightIcon, EllipsisIcon } from '@/components/icons'
import { useTheme } from '@/theme/tokens'
import { StatementYearSummary } from './StatementYearSummary'
import type { LedgerYear } from './statements'

// react-native-svg ships an outline "chart-bar"-shaped icon nowhere in our set
// yet; reuse Ellipsis as the collapsed-state affordance (matches the "more"
// visual weight of the web bar-chart toggle closely enough at 18px).
const ChartBarIcon = EllipsisIcon

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
            <View style={styles.rowMain}>
              <View style={styles.rowText}>
                <Text style={[styles.yearLabel, { color: tokens.ink }]}>{year.year}</Text>
                <Text style={[styles.rowMeta, { color: tokens.muted }]}>12-month statement</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Toggle ${year.year} summary`}
                accessibilityState={{ expanded: isExpanded }}
                onPress={() => toggle(year.id)}
                style={[styles.circleButton, { backgroundColor: tokens.cardAlt }]}
              >
                {isExpanded ? (
                  <ChevronDownIcon size={18} color={tokens.ink} />
                ) : (
                  <ChartBarIcon size={18} color={tokens.ink} />
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${year.year} statement`}
                onPress={() =>
                  router.push({ pathname: '/ledger/[yearId]', params: { yearId: year.id } })
                }
                style={[styles.circleButton, { backgroundColor: tokens.cardAlt }]}
              >
                <ChevronRightIcon size={18} color={tokens.muted} />
              </Pressable>
            </View>
            {isExpanded ? (
              <View style={styles.summary}>
                <StatementYearSummary householdId={householdId} yearId={year.id} />
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { flex: 1 },
  yearLabel: { fontSize: 19, fontWeight: '600' },
  rowMeta: { fontSize: 13, marginTop: 2 },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { marginTop: 12 },
})
