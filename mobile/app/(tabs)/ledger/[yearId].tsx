import { formatMoney } from '@household-hub/domain'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Card } from '@/components/Card'
import { ChevronLeftIcon } from '@/components/icons'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { HOUSEHOLD_CURRENCY, useLedgerAssets } from '@/features/ledger/assets'
import { CategorySheet } from '@/features/ledger/CategorySheet'
import { ClearYearSheet } from '@/features/ledger/ClearYearSheet'
import { StatementCharts } from '@/features/ledger/StatementCharts'
import {
  categoryProgress,
  statementTotals,
  useLedgerYearData,
  useLedgerYears,
  type CategoryKind,
  type CategoryProgress,
  type LedgerTransaction,
} from '@/features/ledger/statements'
import { TransactionList } from '@/features/ledger/TransactionList'
import { TransactionSheet } from '@/features/ledger/TransactionSheet'
import { useTheme } from '@/theme/tokens'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function StatementMonthScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const { yearId } = useLocalSearchParams<{ yearId: string }>()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const years = useLedgerYears(householdId)
  const year = years.data?.find((entry) => entry.id === yearId)
  const query = useLedgerYearData(householdId, yearId)
  const assets = useLedgerAssets(householdId)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [transactionKind, setTransactionKind] = useState<CategoryKind | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<LedgerTransaction | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryProgress | null>(null)
  const [clearOpen, setClearOpen] = useState(false)

  const monthRow = query.data?.months.find((entry) => entry.month === month)
  const categories = useMemo(
    () => (query.data && monthRow ? categoryProgress(query.data, monthRow.id) : []),
    [monthRow, query.data],
  )
  const monthCategories = useMemo(
    () => query.data?.categories.filter((entry) => entry.monthId === monthRow?.id) ?? [],
    [monthRow?.id, query.data?.categories],
  )
  const transactions = useMemo(
    () => query.data?.transactions.filter((entry) => entry.monthId === monthRow?.id) ?? [],
    [monthRow?.id, query.data?.transactions],
  )
  const totals = query.data && monthRow ? statementTotals(query.data, monthRow.id) : null

  if (household.isLoading || years.isLoading || query.isLoading || assets.isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]}>
        <LoadingState />
      </SafeAreaView>
    )
  }
  if (!householdId || household.isError || query.isError || years.isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]}>
        <ErrorState message="Could not load this statement." />
      </SafeAreaView>
    )
  }
  if (!year || !query.data || !monthRow) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]}>
        <EmptyState
          title="Statement not found"
          hint="This year may have been removed, or the link is out of date."
          action={
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/ledger')}
              style={[styles.notFoundButton, { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl }]}
            >
              <Text style={[styles.notFoundButtonText, { color: tokens.accentContrast }]}>
                Back to Ledger
              </Text>
            </Pressable>
          }
        />
      </SafeAreaView>
    )
  }

  const canAddTransaction = (assets.data ?? []).length > 0
  const utilization = totals?.utilization

  function openTransaction(kind: CategoryKind, transaction: LedgerTransaction | null = null) {
    setEditingTransaction(transaction)
    setTransactionKind(kind)
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.replace('/ledger')} style={styles.backRow}>
          <ChevronLeftIcon size={16} color={tokens.muted} />
          <Text style={[styles.backLabel, { color: tokens.muted }]}>Ledger</Text>
        </Pressable>

        <View style={styles.titleRow}>
          <Text style={[styles.pageTitle, { color: tokens.ink }]}>Budget {year.year}</Text>
          <Pressable accessibilityRole="button" onPress={() => setClearOpen(true)}>
            <Text style={[styles.clearLink, { color: tokens.danger }]}>Clear year</Text>
          </Pressable>
        </View>

        <Card style={styles.monthGrid}>
          {MONTHS.map((label, index) => {
            const active = month === index + 1
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setMonth(index + 1)}
                style={[
                  styles.monthCell,
                  { backgroundColor: active ? tokens.ink : tokens.cardAlt, borderRadius: tokens.radiusControl },
                ]}
              >
                <Text style={[styles.monthCellText, { color: active ? tokens.canvas : tokens.ink }]}>
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </Card>

        <View style={styles.section}>
          <StatementCharts data={query.data} monthId={monthRow.id} />
        </View>

        <Card style={styles.budgetCard}>
          <View style={styles.budgetRow}>
            <View style={styles.budgetLeft}>
              <Text style={[styles.budgetLabel, { color: tokens.muted }]}>
                Monthly budget ·{' '}
                {new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year.year, month - 1, 1))}
              </Text>
              <Text style={[styles.budgetValue, { color: tokens.ink }]}>
                {formatMoney(totals?.spendingCents ?? 0, HOUSEHOLD_CURRENCY)}
              </Text>
              <Text style={[styles.budgetSub, { color: tokens.muted }]}>
                of {formatMoney(totals?.limitCents ?? 0, HOUSEHOLD_CURRENCY)} limit
              </Text>
            </View>
            <View style={[styles.budgetRing, { borderColor: tokens.cardAlt }]}>
              <Text style={[styles.budgetPct, { color: tokens.ink }]}>
                {utilization == null ? '—' : `${Math.round(utilization * 100)}%`}
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.metricsRow}>
          <BudgetMetric label="Spent" value={totals?.spendingCents ?? 0} />
          <BudgetMetric label="Limit" value={totals?.limitCents ?? 0} />
          <BudgetMetric label="Left" value={totals?.leftCents ?? 0} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: tokens.muted }]}>Categories</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditingCategory(null)
                setCategoryOpen(true)
              }}
            >
              <Text style={[styles.sectionAction, { color: tokens.accent }]}>+ Category</Text>
            </Pressable>
          </View>
          {categories
            .filter((entry) => entry.kind === 'spending')
            .map((entry) => (
              <Pressable
                key={entry.monthCategoryId}
                onPress={() => {
                  setEditingCategory(entry)
                  setCategoryOpen(true)
                }}
              >
                <Card style={styles.categoryCard}>
                  <View style={styles.categoryRow}>
                    <Text style={[styles.categoryName, { color: tokens.ink }]}>{entry.name}</Text>
                    <Text style={[styles.categoryAmount, { color: tokens.muted }]}>
                      {formatMoney(entry.actualCents, HOUSEHOLD_CURRENCY)}
                      {entry.limitCents !== null
                        ? ` / ${formatMoney(entry.limitCents, HOUSEHOLD_CURRENCY)}`
                        : ''}
                    </Text>
                  </View>
                  {entry.limitCents !== null ? (
                    <View style={[styles.progressTrack, { backgroundColor: tokens.cardAlt }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, (entry.ratio ?? 0) * 100)}%`,
                            backgroundColor: entry.overLimit ? tokens.danger : tokens.accent,
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: tokens.muted }]}>Income</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!canAddTransaction}
              onPress={() => openTransaction('income')}
            >
              <Text
                style={[
                  styles.sectionAction,
                  { color: tokens.accent },
                  !canAddTransaction && styles.disabled,
                ]}
              >
                + Income
              </Text>
            </Pressable>
          </View>
          <TransactionList
            householdId={householdId}
            transactions={transactions.filter((entry) => entry.kind === 'income')}
            categories={monthCategories}
            assets={assets.data ?? []}
            onEdit={(transaction) => openTransaction('income', transaction)}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: tokens.muted }]}>Spending</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!canAddTransaction}
              onPress={() => openTransaction('spending')}
            >
              <Text
                style={[
                  styles.sectionAction,
                  { color: tokens.accent },
                  !canAddTransaction && styles.disabled,
                ]}
              >
                + Spending
              </Text>
            </Pressable>
          </View>
          <TransactionList
            householdId={householdId}
            transactions={transactions.filter((entry) => entry.kind === 'spending')}
            categories={monthCategories}
            assets={assets.data ?? []}
            onEdit={(transaction) => openTransaction('spending', transaction)}
          />
        </View>
      </ScrollView>

      {transactionKind ? (
        <TransactionSheet
          key={`${transactionKind}:${editingTransaction?.id ?? 'new'}`}
          open
          onOpenChange={(open) => {
            if (!open) {
              setTransactionKind(null)
              setEditingTransaction(null)
            }
          }}
          householdId={householdId}
          yearId={year.id}
          month={month}
          kind={transactionKind}
          categories={monthCategories}
          assets={assets.data ?? []}
          transaction={editingTransaction}
        />
      ) : null}
      {categoryOpen ? (
        <CategorySheet
          key={editingCategory ? `${editingCategory.categoryId}:${editingCategory.revision}` : 'new'}
          open
          onOpenChange={(open) => {
            setCategoryOpen(open)
            if (!open) setEditingCategory(null)
          }}
          householdId={householdId}
          yearId={year.id}
          month={month}
          existing={editingCategory}
          nextSortOrder={categories.length}
        />
      ) : null}
      <ClearYearSheet open={clearOpen} onOpenChange={setClearOpen} householdId={householdId} year={year} />
    </SafeAreaView>
  )
}

function BudgetMetric({ label, value }: { label: string; value: number }) {
  const { tokens } = useTheme()
  return (
    <View style={[styles.budgetMetric, { backgroundColor: tokens.cardAlt, borderRadius: tokens.radiusCard }]}>
      <Text style={[styles.budgetMetricLabel, { color: tokens.muted }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.budgetMetricValue, { color: tokens.ink }]}>
        {formatMoney(value, HOUSEHOLD_CURRENCY)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 24 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10 },
  backLabel: { fontSize: 13, fontWeight: '600' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pageTitle: { fontSize: 22, fontWeight: '800' },
  clearLink: { fontSize: 13, fontWeight: '600' },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 10,
  },
  monthCell: { width: '23%', paddingVertical: 12, alignItems: 'center' },
  monthCellText: { fontSize: 13, fontWeight: '700' },
  section: { marginTop: 16 },
  budgetCard: { marginTop: 16 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  budgetLeft: { flex: 1 },
  budgetLabel: { fontSize: 12 },
  budgetValue: { fontSize: 30, fontWeight: '800', marginTop: 6 },
  budgetSub: { fontSize: 12, marginTop: 2 },
  budgetRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetPct: { fontSize: 13, fontWeight: '800' },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  budgetMetric: { flex: 1, padding: 12 },
  budgetMetricLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 },
  budgetMetricValue: { fontSize: 15, fontWeight: '800', marginTop: 6 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionAction: { fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  categoryCard: { marginBottom: 8 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  categoryName: { fontSize: 14, fontWeight: '700' },
  categoryAmount: { fontSize: 12 },
  progressTrack: { height: 6, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  notFoundButton: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  notFoundButtonText: { fontSize: 14, fontWeight: '700' },
})
