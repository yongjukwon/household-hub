import { formatMoney } from '@household-hub/domain'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Card } from '@/components/Card'
import { ListCard } from '@/components/ListCard'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { HOUSEHOLD_CURRENCY, useLedgerAssets } from '@/features/ledger/assets'
import { BudgetMonthSelector } from '@/features/ledger/BudgetMonthSelector'
import { CategorySheet } from '@/features/ledger/CategorySheet'
import { StatementCharts } from '@/features/ledger/StatementCharts'
import {
  categoryProgress,
  resolveTransactionPrerequisite,
  statementTotals,
  useLedgerYearData,
  useLedgerYears,
  type CategoryKind,
  type CategoryProgress,
  type LedgerTransaction,
  type TransactionPrerequisite,
} from '@/features/ledger/statements'
import { TransactionPrerequisiteDialog } from '@/features/ledger/TransactionPrerequisiteDialog'
import { TransactionList } from '@/features/ledger/TransactionList'
import { TransactionSheet } from '@/features/ledger/TransactionSheet'
import { useTheme } from '@/theme/tokens'

export default function StatementMonthScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const { yearId, transactionKind: requestedTransactionKindParam } =
    useLocalSearchParams<{ yearId: string; transactionKind?: string }>()
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
  const [prerequisite, setPrerequisite] = useState<{
    kind: CategoryKind
    prerequisite: TransactionPrerequisite
  } | null>(null)
  const [categoryCreationKind, setCategoryCreationKind] =
    useState<CategoryKind | null>(null)
  const [resumeTransactionKind, setResumeTransactionKind] =
    useState<CategoryKind | null>(null)
  const categorySavedForTransaction = useRef(false)

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
  const cadAssets = useMemo(
    () =>
      (assets.data ?? []).filter(
        (asset) => asset.currencyCode === HOUSEHOLD_CURRENCY,
      ),
    [assets.data],
  )
  const requestedTransactionKind: CategoryKind | null =
    requestedTransactionKindParam === 'income' ||
    requestedTransactionKindParam === 'spending'
      ? requestedTransactionKindParam
      : null
  const requestedPrerequisite = requestedTransactionKind
    ? resolveTransactionPrerequisite(
        requestedTransactionKind,
        cadAssets.length > 0,
        monthCategories,
      )
    : null
  const resumeReady =
    resumeTransactionKind !== null &&
    resolveTransactionPrerequisite(
      resumeTransactionKind,
      cadAssets.length > 0,
      monthCategories,
    ) === null
  const activeTransactionKind =
    transactionKind ??
    (resumeReady ? resumeTransactionKind : null) ??
    (requestedTransactionKind && requestedPrerequisite === null
      ? requestedTransactionKind
      : null)
  const visiblePrerequisite =
    prerequisite ??
    (requestedTransactionKind && requestedPrerequisite
      ? {
          kind: requestedTransactionKind,
          prerequisite: requestedPrerequisite,
        }
      : null)

  if (household.isLoading || years.isLoading || query.isLoading || assets.isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
        <LoadingState />
      </SafeAreaView>
    )
  }
  if (
    !householdId ||
    household.isError ||
    (query.isError && !query.data) ||
    (years.isError && !years.data)
  ) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
        <ErrorState message="Could not load this statement." />
      </SafeAreaView>
    )
  }
  if (!year || !query.data || !monthRow) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
        <EmptyState
          title="Statement not found"
          hint="This year may have been removed, or the link is out of date."
        />
      </SafeAreaView>
    )
  }

  const utilization = totals?.utilization

  function openTransaction(kind: CategoryKind, transaction: LedgerTransaction | null = null) {
    if (!transaction) {
      const missing = resolveTransactionPrerequisite(
        kind,
        cadAssets.length > 0,
        monthCategories,
      )
      if (missing) {
        setPrerequisite({ kind, prerequisite: missing })
        return
      }
      setEditingTransaction(null)
      setTransactionKind(kind)
      return
    }
    setEditingTransaction(transaction)
    setTransactionKind(kind)
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <BudgetMonthSelector month={month} onChange={setMonth} />

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
                setCategoryCreationKind(null)
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
                <ListCard style={styles.categoryCard}>
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
                </ListCard>
              </Pressable>
            ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: tokens.muted }]}>Income</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => openTransaction('income')}
            >
              <Text style={[styles.sectionAction, { color: tokens.accent }]}>
                + Income
              </Text>
            </Pressable>
          </View>
          <TransactionList
            householdId={householdId}
            transactions={transactions.filter((entry) => entry.kind === 'income')}
            categories={monthCategories}
            assets={cadAssets}
            onEdit={(transaction) => openTransaction('income', transaction)}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: tokens.muted }]}>Spending</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => openTransaction('spending')}
            >
              <Text style={[styles.sectionAction, { color: tokens.accent }]}>
                + Spending
              </Text>
            </Pressable>
          </View>
          <TransactionList
            householdId={householdId}
            transactions={transactions.filter((entry) => entry.kind === 'spending')}
            categories={monthCategories}
            assets={cadAssets}
            onEdit={(transaction) => openTransaction('spending', transaction)}
          />
        </View>
      </ScrollView>

      {activeTransactionKind ? (
        <TransactionSheet
          key={`${activeTransactionKind}:${editingTransaction?.id ?? 'new'}`}
          open
          onOpenChange={(open) => {
            if (!open) {
              setTransactionKind(null)
              setResumeTransactionKind(null)
              setEditingTransaction(null)
              if (requestedTransactionKind) {
                router.setParams({ transactionKind: undefined })
              }
            }
          }}
          householdId={householdId}
          yearId={year.id}
          month={month}
          kind={activeTransactionKind}
          categories={monthCategories}
          assets={cadAssets}
          transaction={editingTransaction}
        />
      ) : null}
      {categoryOpen ? (
        <CategorySheet
          key={
            editingCategory
              ? `${editingCategory.categoryId}:${editingCategory.revision}`
              : `new:${categoryCreationKind ?? 'manual'}`
          }
          open
          onOpenChange={(open) => {
            setCategoryOpen(open)
            if (!open) {
              if (
                categoryCreationKind &&
                !categorySavedForTransaction.current
              ) {
                setResumeTransactionKind(null)
              }
              categorySavedForTransaction.current = false
              setEditingCategory(null)
              setCategoryCreationKind(null)
            }
          }}
          householdId={householdId}
          yearId={year.id}
          month={month}
          existing={editingCategory}
          nextSortOrder={categories.length}
          initialKind={categoryCreationKind ?? undefined}
          onSaved={(kind) => {
            if (categoryCreationKind) {
              categorySavedForTransaction.current = true
              setResumeTransactionKind(kind)
            }
          }}
        />
      ) : null}
      {visiblePrerequisite ? (
        <TransactionPrerequisiteDialog
          open
          prerequisite={visiblePrerequisite.prerequisite}
          kind={visiblePrerequisite.kind}
          onOpenChange={(open) => {
            if (!open) {
              setPrerequisite(null)
              if (requestedTransactionKind) {
                router.setParams({ transactionKind: undefined })
              }
            }
          }}
          onContinue={() => {
            const pending = visiblePrerequisite
            setPrerequisite(null)
            if (pending.prerequisite === 'asset') {
              router.push({
                pathname: '/ledger',
                params: {
                  segment: 'assets',
                  newAsset: '1',
                  returnYearId: year.id,
                  returnTransactionKind: pending.kind,
                },
              })
              return
            }
            if (requestedTransactionKind) {
              router.setParams({ transactionKind: undefined })
            }
            categorySavedForTransaction.current = false
            setEditingCategory(null)
            setCategoryCreationKind(pending.kind)
            setResumeTransactionKind(pending.kind)
            setCategoryOpen(true)
          }}
        />
      ) : null}
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
})
