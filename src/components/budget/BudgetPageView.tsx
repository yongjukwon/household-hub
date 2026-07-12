import { useMemo, useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import type { PageRow } from '@/hooks/usePages'
import {
  budgetKeys,
  centsToAmount,
  currentMonthKey,
  effectiveLimit,
  moneyToCents,
  useBudgetCategories,
  useBudgetCategoryLimits,
  useBudgetEntries,
  useDeleteBudgetCategory,
  useDeleteBudgetEntry,
  type BudgetCategory,
  type BudgetCategoryLimit,
  type BudgetEntry,
} from '@/hooks/useBudget'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MonthPicker } from './MonthPicker'
import { BudgetChart, type BudgetChartDatum } from './BudgetChart'
import { DeleteDialog } from '@/components/common/DeleteDialog'
import { CategoryDialog, EntryDialog } from './BudgetDialogs'

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'CAD',
})
const EMPTY_CATEGORIES: BudgetCategory[] = []
const EMPTY_ENTRIES: BudgetEntry[] = []
const EMPTY_LIMITS: BudgetCategoryLimit[] = []

type DeleteTarget =
  | { kind: 'category'; category: BudgetCategory }
  | { kind: 'entry'; entry: BudgetEntry }
  | null

interface BudgetPageViewProps {
  page: PageRow
}

export function BudgetPageView({ page }: BudgetPageViewProps) {
  const [month, setMonth] = useState(currentMonthKey)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(
    null,
  )
  const [entryDialogOpen, setEntryDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null)
  const [initialCategoryId, setInitialCategoryId] = useState<string | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const categoriesQuery = useBudgetCategories(page.id)
  const entriesQuery = useBudgetEntries(page.id, month)
  const limitsQuery = useBudgetCategoryLimits(page.id)
  useRealtimeTable(
    'budget_categories',
    'page_id',
    page.id,
    budgetKeys.categories(page.id),
  )
  // The entries prefix covers every cached month for this page — a remote
  // edit may move an entry across months.
  useRealtimeTable(
    'budget_entries',
    'page_id',
    page.id,
    budgetKeys.entries(page.id),
  )
  useRealtimeTable(
    'budget_category_limits',
    'page_id',
    page.id,
    budgetKeys.limits(page.id),
  )
  const deleteCategory = useDeleteBudgetCategory()
  const deleteEntry = useDeleteBudgetEntry()

  const categories = categoriesQuery.data ?? EMPTY_CATEGORIES
  const entries = entriesQuery.data ?? EMPTY_ENTRIES
  const limits = limitsQuery.data ?? EMPTY_LIMITS
  // Effective per-category limit (in cents) for the selected month, honoring
  // carry-forward overrides. Everything downstream — totals, chart, progress —
  // reads from this map rather than category.monthly_limit directly.
  const limitCentsByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const category of categories) {
      map.set(category.id, moneyToCents(effectiveLimit(category, limits, month)))
    }
    return map
  }, [categories, limits, month])
  const summary = useMemo(
    () => buildSummary(categories, entries, limitCentsByCategory),
    [categories, entries, limitCentsByCategory],
  )

  function openNewCategory() {
    setEditingCategory(null)
    setCategoryDialogOpen(true)
  }

  function openEditCategory(category: BudgetCategory) {
    setEditingCategory(category)
    setCategoryDialogOpen(true)
  }

  function openNewEntry(categoryId: string | null = null) {
    setEditingEntry(null)
    setInitialCategoryId(categoryId)
    setEntryDialogOpen(true)
  }

  function openEditEntry(entry: BudgetEntry) {
    setEditingEntry(entry)
    setInitialCategoryId(entry.category_id)
    setEntryDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'category') {
      await deleteCategory.mutateAsync({
        id: deleteTarget.category.id,
        pageId: page.id,
      })
    } else {
      await deleteEntry.mutateAsync({
        id: deleteTarget.entry.id,
        pageId: page.id,
      })
    }
  }

  const isPending =
    categoriesQuery.isPending || entriesQuery.isPending || limitsQuery.isPending
  const isError =
    categoriesQuery.isError || entriesQuery.isError || limitsQuery.isError

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
            {page.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--meta)]">Monthly budget</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 text-[var(--accent)]"
          aria-label="Add category"
          onClick={openNewCategory}
        >
          <Plus />
        </Button>
      </header>

      <div className="mt-5">
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      {isPending ? (
        <p
          role="status"
          className="mt-16 text-center text-sm text-[var(--meta)]"
        >
          Loading budget…
        </p>
      ) : isError ? (
        <div className="mt-12 text-center">
          <p role="alert" className="text-sm text-[var(--danger)]">
            Couldn’t load this budget — check your connection and try again.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => {
              void categoriesQuery.refetch()
              void entriesQuery.refetch()
              void limitsQuery.refetch()
            }}
          >
            Try again
          </Button>
        </div>
      ) : categories.length === 0 ? (
        <section
          className="mt-16 text-center"
          aria-labelledby="empty-budget-title"
        >
          <h2
            id="empty-budget-title"
            className="font-semibold text-[var(--text)]"
          >
            Create your first category
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--meta)]">
            Categories give spending a monthly limit and make progress easy to
            see.
          </p>
          <Button type="button" className="mt-5" onClick={openNewCategory}>
            <Plus data-icon="inline-start" />
            Add category
          </Button>
        </section>
      ) : (
        <>
          <BudgetSummary
            spentCents={summary.totalSpentCents}
            limitCents={summary.totalLimitCents}
          />

          {/* Chart sits above the category list: the list grows over time and
              would otherwise bury the at-a-glance chart below the fold. */}
          <BudgetChart
            data={summary.chartData}
            formatCurrency={formatCurrency}
          />

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-[var(--meta)]">
              CATEGORIES
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={() => openNewEntry()}
            >
              <Plus data-icon="inline-start" />
              Add entry
            </Button>
          </div>

          <div className="mt-3 space-y-3">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                entries={summary.entriesByCategory.get(category.id) ?? []}
                spentCents={summary.spentByCategory.get(category.id) ?? 0}
                limitCents={limitCentsByCategory.get(category.id) ?? 0}
                onAddEntry={() => openNewEntry(category.id)}
                onEditCategory={() => openEditCategory(category)}
                onDeleteCategory={() =>
                  setDeleteTarget({ kind: 'category', category })
                }
                onEditEntry={openEditEntry}
                onDeleteEntry={(entry) =>
                  setDeleteTarget({ kind: 'entry', entry })
                }
              />
            ))}
          </div>
        </>
      )}

      {categoryDialogOpen && (
        <CategoryDialog
          key={editingCategory?.id ?? 'new-category'}
          open
          onOpenChange={setCategoryDialogOpen}
          pageId={page.id}
          month={month}
          category={editingCategory}
          initialLimit={
            editingCategory
              ? centsToAmount(limitCentsByCategory.get(editingCategory.id) ?? 0)
              : 0
          }
          nextSortOrder={nextSortOrder(categories)}
        />
      )}
      {entryDialogOpen && (
        <EntryDialog
          key={editingEntry?.id ?? `new-entry-${initialCategoryId ?? 'any'}`}
          open
          onOpenChange={setEntryDialogOpen}
          pageId={page.id}
          month={month}
          categories={categories}
          entry={editingEntry}
          initialCategoryId={initialCategoryId}
        />
      )}
      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={
          deleteTarget?.kind === 'category'
            ? 'Delete category?'
            : 'Delete entry?'
        }
        description={
          deleteTarget?.kind === 'category'
            ? `“${deleteTarget.category.name}” and all of its entries across every month will be permanently deleted.`
            : 'This budget entry will be permanently deleted.'
        }
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function BudgetSummary({
  spentCents,
  limitCents,
}: {
  spentCents: number
  limitCents: number
}) {
  const remainingCents = limitCents - spentCents
  return (
    <section
      className="mt-6 grid grid-cols-3 gap-2"
      aria-label="Budget summary"
    >
      <SummaryValue
        label="Spent"
        value={formatCurrency(centsToAmount(spentCents))}
      />
      <SummaryValue
        label="Limit"
        value={formatCurrency(centsToAmount(limitCents))}
      />
      <SummaryValue
        label={remainingCents >= 0 ? 'Remaining' : 'Over'}
        value={formatCurrency(centsToAmount(Math.abs(remainingCents)))}
        danger={remainingCents < 0}
      />
    </section>
  )
}

function SummaryValue({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--line2)] bg-[var(--panel)] p-3">
      <p className="text-[11px] font-semibold tracking-wide text-[var(--meta)]">
        {label.toUpperCase()}
      </p>
      <p
        className={`mt-1 truncate text-sm font-semibold ${danger ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

interface CategoryCardProps {
  category: BudgetCategory
  entries: BudgetEntry[]
  spentCents: number
  limitCents: number
  onAddEntry: () => void
  onEditCategory: () => void
  onDeleteCategory: () => void
  onEditEntry: (entry: BudgetEntry) => void
  onDeleteEntry: (entry: BudgetEntry) => void
}

function CategoryCard({
  category,
  entries,
  spentCents,
  limitCents,
  onAddEntry,
  onEditCategory,
  onDeleteCategory,
  onEditEntry,
  onDeleteEntry,
}: CategoryCardProps) {
  const percent =
    limitCents === 0
      ? spentCents > 0
        ? 100
        : 0
      : (spentCents / limitCents) * 100
  const remainingCents = limitCents - spentCents
  const progressText = `${category.name}: ${formatCurrency(centsToAmount(spentCents))} spent of ${formatCurrency(centsToAmount(limitCents))}${remainingCents < 0 ? `, ${formatCurrency(centsToAmount(Math.abs(remainingCents)))} over` : ''}`

  return (
    <section
      className="rounded-xl border border-[var(--line2)] bg-[var(--panel)] p-4"
      aria-labelledby={`category-${category.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            id={`category-${category.id}`}
            className="truncate font-semibold text-[var(--text)]"
          >
            {category.name}
          </h3>
          <p className="mt-1 text-sm text-[var(--meta)]">
            {formatCurrency(centsToAmount(spentCents))} of{' '}
            {formatCurrency(centsToAmount(limitCents))}
            {remainingCents < 0 && (
              <span className="ml-2 font-medium text-[var(--danger)]">
                {formatCurrency(centsToAmount(Math.abs(remainingCents)))} over
              </span>
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={`Actions for ${category.name}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onAddEntry}>Add entry</DropdownMenuItem>
            <DropdownMenuItem onSelect={onEditCategory}>
              Edit category
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[var(--danger)] focus:text-[var(--danger)]"
              onSelect={onDeleteCategory}
            >
              Delete category
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Progress
        className="mt-3 h-2 [&_[data-slot=progress-indicator]]:bg-[var(--accent)]"
        value={Math.max(0, Math.min(100, percent))}
        aria-label={progressText}
        aria-valuetext={progressText}
      />

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--meta)]">No entries this month</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--line2)]">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 py-3 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--text)]">
                  {entry.description || 'Expense'}
                </p>
                <p className="mt-0.5 text-xs text-[var(--meta)]">
                  {formatDate(entry.entry_date)}
                </p>
              </div>
              <span className="text-sm font-medium text-[var(--text)]">
                {formatCurrency(entry.amount)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Actions for ${entry.description || 'expense'}`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEditEntry(entry)}>
                    Edit entry
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-[var(--danger)] focus:text-[var(--danger)]"
                    onSelect={() => onDeleteEntry(entry)}
                  >
                    Delete entry
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function buildSummary(
  categories: BudgetCategory[],
  entries: BudgetEntry[],
  limitCentsByCategory: Map<string, number>,
) {
  const spentByCategory = new Map<string, number>()
  const entriesByCategory = new Map<string, BudgetEntry[]>()
  let totalSpentCents = 0
  let totalLimitCents = 0

  for (const category of categories) {
    spentByCategory.set(category.id, 0)
    entriesByCategory.set(category.id, [])
    totalLimitCents += limitCentsByCategory.get(category.id) ?? 0
  }
  for (const entry of entries) {
    const amountCents = moneyToCents(entry.amount)
    totalSpentCents += amountCents
    spentByCategory.set(
      entry.category_id,
      (spentByCategory.get(entry.category_id) ?? 0) + amountCents,
    )
    const categoryEntries = entriesByCategory.get(entry.category_id)
    if (categoryEntries) categoryEntries.push(entry)
  }

  const chartData: BudgetChartDatum[] = categories.map((category) => ({
    name: category.name,
    spentCents: spentByCategory.get(category.id) ?? 0,
    limitCents: limitCentsByCategory.get(category.id) ?? 0,
  }))

  return {
    totalSpentCents,
    totalLimitCents,
    spentByCategory,
    entriesByCategory,
    chartData,
  }
}

function nextSortOrder(categories: BudgetCategory[]): number {
  return categories.reduce(
    (maximum, category) => Math.max(maximum, category.sort_order + 1),
    0,
  )
}

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}
