import { formatMoney } from '@household-hub/domain'
import { StyleSheet, Text, View } from 'react-native'

import { Card } from '@/components/Card'
import { DonutChart } from '@/components/DonutChart'
import { useTheme } from '@/theme/tokens'
import { HOUSEHOLD_CURRENCY } from './assets'
import {
  monthlyBudgetLimits,
  spendingCategoryTotals,
  statementTotals,
  type LedgerYearData,
} from './statements'

const COLORS = ['#5B73EA', '#FF7A45', '#D99500', '#2CA58D', '#8B5CF6', '#EC4899']

export function StatementCharts({
  data,
  monthId,
  showMonthlyLimits = false,
}: {
  data: LedgerYearData
  monthId?: string
  showMonthlyLimits?: boolean
}) {
  const { tokens } = useTheme()
  const totals = statementTotals(data, monthId)
  const categories = spendingCategoryTotals(data, monthId)
  const limits = monthlyBudgetLimits(data)
  const maxLimit = Math.max(...limits.map((entry) => entry.limitCents), 1)

  return (
    <View style={styles.stack}>
      <Card>
        <Text style={[styles.sectionLabel, { color: tokens.muted }]}>
          {monthId ? 'Monthly statement' : 'Statement summary'}
        </Text>
        <View style={styles.metricsRow}>
          <Metric label="Income" value={totals.incomeCents} />
          <Metric label="Spending" value={totals.spendingCents} />
        </View>
        <View style={styles.chartRow}>
          <DonutChart
            size={72}
            strokeWidth={16}
            slices={categories.map((category, index) => ({
              key: category.categoryId,
              value: category.totalCents,
              color: COLORS[index % COLORS.length],
            }))}
          />
          <View style={styles.legend}>
            {categories.map((category, index) => (
              <View key={category.categoryId} style={styles.legendRow}>
                <View style={styles.legendLeft}>
                  <View style={[styles.legendSwatch, { backgroundColor: COLORS[index % COLORS.length] }]} />
                  <Text style={[styles.legendName, { color: tokens.muted }]} numberOfLines={1}>
                    {category.name}
                  </Text>
                </View>
                <Text style={[styles.legendValue, { color: tokens.ink }]}>
                  {formatMoney(category.totalCents, HOUSEHOLD_CURRENCY)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      {showMonthlyLimits ? (
        <Card>
          <Text style={[styles.sectionLabel, { color: tokens.muted, marginBottom: 12 }]}>
            Monthly budget limits
          </Text>
          <View style={styles.barChart}>
            {limits.map((entry) => (
              <View key={entry.month} style={styles.barCol}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, (entry.limitCents / maxLimit) * 68),
                      backgroundColor: tokens.accent,
                      opacity: entry.limitCents > 0 ? 1 : 0.2,
                    },
                  ]}
                />
                <Text style={[styles.barLabel, { color: tokens.muted }]}>
                  {new Intl.DateTimeFormat('en', { month: 'short' }).format(
                    new Date(2026, entry.month - 1, 1),
                  )}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  const { tokens } = useTheme()
  return (
    <View>
      <Text style={[styles.metricValue, { color: tokens.ink }]}>
        {formatMoney(value, HOUSEHOLD_CURRENCY)}
      </Text>
      <Text style={[styles.metricLabel, { color: tokens.muted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 24, marginTop: 10, marginBottom: 14 },
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricLabel: { fontSize: 11, marginTop: 2 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  legendSwatch: { width: 8, height: 8, borderRadius: 2 },
  legendName: { fontSize: 11.5, flexShrink: 1 },
  legendValue: { fontSize: 11.5, fontWeight: '700' },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 96 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { fontSize: 9 },
})
