import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { formatMoney } from '@household-hub/domain'
import { Screen } from '@/shell/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import { useActiveHousehold } from '@/features/household'
import { HOUSEHOLD_CURRENCY, useLedgerAssets } from './assets'
import { CategorySheet } from './CategorySheet'
import { ClearYearSheet } from './ClearYearSheet'
import { StatementCharts } from './StatementCharts'
import {
  categoryProgress,
  statementTotals,
  useLedgerYearData,
  useLedgerYears,
  type CategoryKind,
  type CategoryProgress,
  type LedgerTransaction,
} from './statements'
import { TransactionList } from './TransactionList'
import { TransactionSheet } from './TransactionSheet'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function StatementMonthScreen() {
  const { yearId } = useParams<{ yearId: string }>()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const years = useLedgerYears(householdId)
  const year = years.data?.find((entry) => entry.id === yearId)
  const query = useLedgerYearData(householdId, yearId)
  const assets = useLedgerAssets(householdId)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [transactionKind, setTransactionKind] = useState<CategoryKind | null>(null)
  const [editingTransaction, setEditingTransaction] =
    useState<LedgerTransaction | null>(null)
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
    return <Screen title="Ledger"><LoadingState /></Screen>
  }
  if (!householdId || household.isError || query.isError || years.isError) {
    return (
      <Screen title="Ledger">
        <ErrorState message="Could not load this statement." />
      </Screen>
    )
  }
  if (!year || !query.data || !monthRow) {
    return (
      <Screen title="Ledger">
        <EmptyState
          title="Statement not found"
          hint="This year may have been removed, or the link is out of date."
          action={
            <Link
              to="/ledger"
              className="inline-flex items-center gap-1 rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Back to Ledger
            </Link>
          }
        />
      </Screen>
    )
  }

  const canAddTransaction = (assets.data ?? []).length > 0
  const utilization = totals?.utilization

  function openTransaction(kind: CategoryKind, transaction: LedgerTransaction | null = null) {
    setEditingTransaction(transaction)
    setTransactionKind(kind)
  }

  return (
    <Screen
      title={`Budget ${year.year}`}
      action={
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          className="rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-medium text-[var(--hh-danger)]"
        >
          Clear year
        </button>
      }
    >
      <Link
        to="/ledger"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--hh-muted)]"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Ledger
      </Link>

      <div className="mb-4 grid grid-cols-4 gap-2 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 shadow-[var(--hh-shadow-card)]">
        {MONTHS.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={month === index + 1}
            onClick={() => setMonth(index + 1)}
            className={
              'rounded-[var(--hh-radius-control)] px-2 py-3 text-sm font-semibold ' +
              (month === index + 1
                ? 'bg-[var(--hh-ink)] text-[var(--hh-canvas)]'
                : 'bg-[var(--hh-surface-2)] text-[var(--hh-ink)]')
            }
          >
            {label}
          </button>
        ))}
      </div>

      <StatementCharts data={query.data} monthId={monthRow.id} />

      <section className="mt-4 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--hh-muted)]">
              Monthly budget · {new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year.year, month - 1, 1))}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--hh-ink)]">
              {formatMoney(totals?.spendingCents ?? 0, HOUSEHOLD_CURRENCY)}
            </p>
            <p className="text-sm text-[var(--hh-muted)]">
              of {formatMoney(totals?.limitCents ?? 0, HOUSEHOLD_CURRENCY)} limit
            </p>
          </div>
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-[12px] border-[var(--hh-surface-2)] text-lg font-bold text-[var(--hh-ink)]">
            {utilization == null ? '—' : `${Math.round(utilization * 100)}%`}
          </div>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <BudgetMetric label="Spent" value={totals?.spendingCents ?? 0} />
        <BudgetMetric label="Limit" value={totals?.limitCents ?? 0} />
        <BudgetMetric label="Left" value={totals?.leftCents ?? 0} />
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--hh-muted)]">Categories</h2>
          <button
            type="button"
            onClick={() => {
              setEditingCategory(null)
              setCategoryOpen(true)
            }}
            className="rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-semibold text-[var(--hh-accent)]"
          >
            + Category
          </button>
        </div>
        <ul className="mt-2 space-y-2">
          {categories.filter((entry) => entry.kind === 'spending').map((entry) => (
            <li key={entry.monthCategoryId}>
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(entry)
                  setCategoryOpen(true)
                }}
                className="w-full rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 text-left shadow-[var(--hh-shadow-card)]"
              >
                <div className="flex justify-between gap-3">
                  <span className="font-semibold text-[var(--hh-ink)]">{entry.name}</span>
                  <span className="tabular-nums text-[var(--hh-muted)]">
                    {formatMoney(entry.actualCents, HOUSEHOLD_CURRENCY)}
                    {entry.limitCents !== null && ` / ${formatMoney(entry.limitCents, HOUSEHOLD_CURRENCY)}`}
                  </span>
                </div>
                {entry.limitCents !== null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--hh-surface-2)]">
                    <div
                      className={`h-full rounded-full ${entry.overLimit ? 'bg-[var(--hh-danger)]' : 'bg-[var(--hh-accent)]'}`}
                      style={{ width: `${Math.min(100, (entry.ratio ?? 0) * 100)}%` }}
                    />
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--hh-muted)]">Income</h2>
          <button
            type="button"
            disabled={!canAddTransaction}
            onClick={() => openTransaction('income')}
            className="rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-semibold text-[var(--hh-accent)] disabled:opacity-40"
          >
            + Income
          </button>
        </div>
        <TransactionList
          householdId={householdId}
          transactions={transactions.filter((entry) => entry.kind === 'income')}
          categories={monthCategories}
          assets={assets.data ?? []}
          onEdit={(transaction) => openTransaction('income', transaction)}
        />
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--hh-muted)]">Spending</h2>
          <button
            type="button"
            disabled={!canAddTransaction}
            onClick={() => openTransaction('spending')}
            className="rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-semibold text-[var(--hh-accent)] disabled:opacity-40"
          >
            + Spending
          </button>
        </div>
        <TransactionList
          householdId={householdId}
          transactions={transactions.filter((entry) => entry.kind === 'spending')}
          categories={monthCategories}
          assets={assets.data ?? []}
          onEdit={(transaction) => openTransaction('spending', transaction)}
        />
      </section>

      {transactionKind && (
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
      )}
      {categoryOpen && (
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
      )}
      <ClearYearSheet
        open={clearOpen}
        onOpenChange={setClearOpen}
        householdId={householdId}
        year={year}
      />
    </Screen>
  )
}

function BudgetMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface-2)] p-3">
      <p className="text-xs font-semibold uppercase text-[var(--hh-muted)]">{label}</p>
      <p className="mt-1 font-bold tabular-nums text-[var(--hh-ink)]">
        {formatMoney(value, HOUSEHOLD_CURRENCY)}
      </p>
    </div>
  )
}
