import { useMemo, useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { formatMoney } from '@household-hub/domain'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import { HOUSEHOLD_CURRENCY, useLedgerAssets } from './assets'
import {
  categoryProgress,
  monthSummaries,
  useLedgerYearData,
  useLedgerYears,
  type CategoryProgress,
} from './statements'
import { createYear } from './statementMutations'
import { TransactionSheet } from './TransactionSheet'
import { CategorySheet } from './CategorySheet'
import { ClearYearSheet } from './ClearYearSheet'

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** Statements segment: years, months, categories, limits, and transactions. */
export function StatementsTab({ householdId }: { householdId: string }) {
  const years = useLedgerYears(householdId)
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null)
  const currentYearId = selectedYearId ?? years.data?.[0]?.id ?? null
  const currentYear = years.data?.find((y) => y.id === currentYearId) ?? null

  const yearData = useLedgerYearData(householdId, currentYearId ?? undefined)
  const assets = useLedgerAssets(householdId)

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [txSheet, setTxSheet] = useState(false)
  const [categorySheet, setCategorySheet] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryProgress | null>(null)
  const [clearSheet, setClearSheet] = useState(false)

  const summaries = useMemo(
    () => (yearData.data ? monthSummaries(yearData.data) : []),
    [yearData.data],
  )
  const activeMonth = selectedMonth ?? new Date().getMonth() + 1
  const monthRow = yearData.data?.months.find((m) => m.month === activeMonth)
  const rows = useMemo(
    () =>
      yearData.data && monthRow
        ? categoryProgress(yearData.data, monthRow.id)
        : [],
    [yearData.data, monthRow],
  )

  async function handleCreateYear() {
    const next = new Date().getFullYear()
    await createYear(householdId, crypto.randomUUID(), next)
  }

  if (years.isLoading) return <LoadingState />
  if (years.isError)
    return <ErrorState message="Could not load Ledger years." onRetry={() => void years.refetch()} />

  if ((years.data ?? []).length === 0) {
    return (
      <EmptyState
        title="No years yet"
        hint="Create a Ledger year to start tracking income and spending."
        action={
          <button
            type="button"
            onClick={() => void handleCreateYear()}
            className="rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2 font-medium text-white"
          >
            Create {new Date().getFullYear()}
          </button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          aria-label="Year"
          className="rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)]"
          value={currentYearId ?? ''}
          onChange={(e) => {
            setSelectedYearId(e.target.value)
            setSelectedMonth(null)
          }}
        >
          {(years.data ?? []).map((y) => (
            <option key={y.id} value={y.id}>
              {y.year}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void handleCreateYear()}
          className="rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-medium text-[var(--hh-muted)]"
        >
          + Year
        </button>
        {currentYear && (
          <button
            type="button"
            onClick={() => setClearSheet(true)}
            className="ml-auto rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-medium text-[var(--hh-danger)]"
          >
            Clear year
          </button>
        )}
      </div>

      {/* 4×3 month picker */}
      <div className="grid grid-cols-4 gap-2">
        {MONTH_ABBR.map((abbr, i) => {
          const month = i + 1
          const summary = summaries.find((s) => s.month === month)
          const active = month === activeMonth
          return (
            <button
              key={abbr}
              type="button"
              onClick={() => setSelectedMonth(month)}
              aria-pressed={active}
              aria-label={abbr}
              className={
                'rounded-[var(--hh-radius-control)] px-2 py-3 text-center ' +
                (active
                  ? 'bg-[var(--hh-accent)] text-white'
                  : 'bg-[var(--hh-surface)] text-[var(--hh-ink)] shadow-[var(--hh-shadow-card)]')
              }
            >
              <span className="block text-sm font-semibold">{abbr}</span>
              <span
                className={
                  'block text-xs tabular-nums ' +
                  (active ? 'text-white/80' : 'text-[var(--hh-muted)]')
                }
              >
                {summary && summary.netCents !== 0
                  ? formatMoney(summary.netCents, HOUSEHOLD_CURRENCY)
                  : '—'}
              </span>
            </button>
          )
        })}
      </div>

      {yearData.isLoading ? (
        <LoadingState />
      ) : (
        <MonthDetail
          rows={rows}
          onAddCategory={() => {
            setEditingCategory(null)
            setCategorySheet(true)
          }}
          onEditCategory={(row) => {
            setEditingCategory(row)
            setCategorySheet(true)
          }}
          onAddTransaction={() => setTxSheet(true)}
          canAddTransaction={rows.length > 0 && (assets.data ?? []).length > 0}
        />
      )}

      {monthRow && currentYearId && (
        <>
          <TransactionSheet
            open={txSheet}
            onOpenChange={setTxSheet}
            householdId={householdId}
            yearId={currentYearId}
            month={activeMonth}
            categories={yearData.data?.categories.filter((c) => c.monthId === monthRow.id) ?? []}
            assets={assets.data ?? []}
          />
          {categorySheet && (
            <CategorySheet
              key={editingCategory ? `${editingCategory.categoryId}:${editingCategory.revision}` : 'new'}
              open={categorySheet}
              onOpenChange={(open) => {
                setCategorySheet(open)
                if (!open) setEditingCategory(null)
              }}
              householdId={householdId}
              yearId={currentYearId}
              month={activeMonth}
              existing={editingCategory}
              nextSortOrder={rows.length}
            />
          )}
        </>
      )}
      {currentYear && (
        <ClearYearSheet
          open={clearSheet}
          onOpenChange={setClearSheet}
          householdId={householdId}
          year={currentYear}
        />
      )}
    </div>
  )
}

function MonthDetail({
  rows,
  onAddCategory,
  onEditCategory,
  onAddTransaction,
  canAddTransaction,
}: {
  rows: CategoryProgress[]
  onAddCategory: () => void
  onEditCategory: (row: CategoryProgress) => void
  onAddTransaction: () => void
  canAddTransaction: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-[var(--hh-muted)]">Categories</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddTransaction}
            disabled={!canAddTransaction}
            className="rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Add transaction
          </button>
          <button
            type="button"
            onClick={onAddCategory}
            aria-label="New category"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hh-surface-2)] text-[var(--hh-ink)]"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No categories" hint="Add a category for this month." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.monthCategoryId}>
              <button
                type="button"
                onClick={() => onEditCategory(row)}
                className="w-full rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 text-left shadow-[var(--hh-shadow-card)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--hh-ink)]">{row.name}</span>
                  <span className="text-sm tabular-nums text-[var(--hh-ink)]">
                    {formatMoney(row.actualCents, HOUSEHOLD_CURRENCY)}
                    {row.limitCents !== null && (
                      <span className="text-[var(--hh-muted)]">
                        {' '}
                        / {formatMoney(row.limitCents, HOUSEHOLD_CURRENCY)}
                      </span>
                    )}
                  </span>
                </div>
                {row.kind === 'spending' && row.limitCents !== null && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--hh-surface-2)]">
                    <div
                      className={
                        'h-full rounded-full ' +
                        (row.overLimit ? 'bg-[var(--hh-danger)]' : 'bg-[var(--hh-accent)]')
                      }
                      style={{ width: `${Math.min(100, (row.ratio ?? 0) * 100)}%` }}
                    />
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
