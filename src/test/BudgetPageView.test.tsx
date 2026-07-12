import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BudgetPageView } from '@/components/budget/BudgetPageView'
import {
  currentMonthKey,
  shiftMonthKey,
  useBudgetCategories,
  useBudgetCategoryLimits,
  useBudgetEntries,
  useDeleteBudgetCategory,
  useDeleteBudgetEntry,
} from '@/hooks/useBudget'

vi.mock('@/hooks/useBudget', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useBudget')>()
  return {
    ...actual,
    useBudgetCategories: vi.fn(),
    useBudgetEntries: vi.fn(),
    useBudgetCategoryLimits: vi.fn(),
    useDeleteBudgetCategory: vi.fn(),
    useDeleteBudgetEntry: vi.fn(),
    useCreateBudgetCategory: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useUpdateBudgetCategory: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useSetBudgetCategoryLimit: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useCreateBudgetEntry: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useUpdateBudgetEntry: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
  }
})

vi.mock('@/hooks/useRealtimeTable', () => ({
  useRealtimeTable: vi.fn(),
}))

vi.mock('@/components/pages/EditableTitle', () => ({
  EditableTitle: ({ page }: { page: { title: string } }) => (
    <h1>{page.title}</h1>
  ),
}))

vi.mock('@/components/budget/BudgetChart', () => ({
  BudgetChart: ({
    data,
  }: {
    data: Array<{ name: string; spentCents: number; limitCents: number }>
  }) => <div data-testid="budget-chart">{JSON.stringify(data)}</div>,
}))

const mockUseBudgetCategories = vi.mocked(useBudgetCategories)
const mockUseBudgetEntries = vi.mocked(useBudgetEntries)
const mockUseBudgetCategoryLimits = vi.mocked(useBudgetCategoryLimits)
const mockUseDeleteBudgetCategory = vi.mocked(useDeleteBudgetCategory)
const mockUseDeleteBudgetEntry = vi.mocked(useDeleteBudgetEntry)

const refetchCategories = vi.fn()
const refetchEntries = vi.fn()
const refetchLimits = vi.fn()
const deleteCategory = vi.fn()
const deleteEntry = vi.fn()

const page = {
  id: 'page-1',
  household_id: 'household-1',
  section: 'budget' as const,
  template: 'budget' as const,
  title: 'Household budget',
  content: { type: 'doc', content: [] },
  created_by: 'user-1',
  archived: false,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

const food = {
  id: 'category-food',
  household_id: 'household-1',
  page_id: 'page-1',
  name: 'Food',
  monthly_limit: 100,
  sort_order: 0,
  created_at: '2026-07-01T00:00:00.000Z',
}

const transport = {
  ...food,
  id: 'category-transport',
  name: 'Transport',
  monthly_limit: 50,
  sort_order: 1,
}

const lunch = {
  id: 'entry-1',
  household_id: 'household-1',
  page_id: 'page-1',
  category_id: 'category-food',
  amount: 125,
  description: 'Lunch',
  entry_date: '2026-07-11',
  created_by: 'user-1',
  created_at: '2026-07-11T18:00:00.000Z',
}

function queryResult(
  data: unknown,
  options: {
    isPending?: boolean
    isError?: boolean
    refetch?: () => unknown
  } = {},
) {
  return {
    data,
    isPending: options.isPending ?? false,
    isError: options.isError ?? false,
    refetch: options.refetch ?? vi.fn(),
  }
}

function setQueries({
  categories = [],
  entries = [],
  limits = [],
  categoriesPending = false,
  entriesPending = false,
  categoriesError = false,
  entriesError = false,
}: {
  categories?: unknown[]
  entries?: unknown[]
  limits?: unknown[]
  categoriesPending?: boolean
  entriesPending?: boolean
  categoriesError?: boolean
  entriesError?: boolean
} = {}) {
  mockUseBudgetCategories.mockReturnValue(
    queryResult(categories, {
      isPending: categoriesPending,
      isError: categoriesError,
      refetch: refetchCategories,
    }) as never,
  )
  mockUseBudgetEntries.mockReturnValue(
    queryResult(entries, {
      isPending: entriesPending,
      isError: entriesError,
      refetch: refetchEntries,
    }) as never,
  )
  mockUseBudgetCategoryLimits.mockReturnValue(
    queryResult(limits, { refetch: refetchLimits }) as never,
  )
}

describe('BudgetPageView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setQueries()
    mockUseDeleteBudgetCategory.mockReturnValue({
      mutateAsync: deleteCategory,
    } as never)
    mockUseDeleteBudgetEntry.mockReturnValue({
      mutateAsync: deleteEntry,
    } as never)
  })

  it('renders a named loading state without showing the empty setup state', () => {
    setQueries({ categoriesPending: true })
    render(<BudgetPageView page={page} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading budget…')
    expect(
      screen.queryByRole('heading', { name: 'Create your first category' }),
    ).not.toBeInTheDocument()
  })

  it('renders a query error and retries both category and entry queries', () => {
    setQueries({ entriesError: true })
    render(<BudgetPageView page={page} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      /couldn.t load this budget/i,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetchCategories).toHaveBeenCalledOnce()
    expect(refetchEntries).toHaveBeenCalledOnce()
  })

  it('shows a first-category CTA that opens the accessible category dialog', async () => {
    const user = userEvent.setup()
    render(<BudgetPageView page={page} />)

    expect(
      screen.getByRole('heading', { name: 'Create your first category' }),
    ).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Add category' })[1])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'New category' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })

  it('renders totals, over-budget category progress, entries, empty categories, and chart data', () => {
    setQueries({ categories: [food, transport], entries: [lunch] })
    render(<BudgetPageView page={page} />)

    const summary = screen.getByRole('region', { name: 'Budget summary' })
    expect(summary).toHaveTextContent('SPENT')
    expect(summary).toHaveTextContent('LIMIT')
    expect(summary).toHaveTextContent('REMAINING')
    expect(summary).toHaveTextContent(/125\.00/)
    expect(summary).toHaveTextContent(/150\.00/)
    expect(summary).toHaveTextContent(/25\.00/)

    const foodRegion = screen
      .getByRole('heading', { name: 'Food' })
      .closest('section')!
    expect(within(foodRegion).getByText('Lunch')).toBeInTheDocument()
    expect(within(foodRegion).getByText(/25\.00 over/)).toBeInTheDocument()
    expect(
      within(foodRegion).getByRole('progressbar', {
        name: /Food.*spent.*over/,
      }),
    ).toHaveAttribute('aria-valuetext', expect.stringMatching(/25\.00 over/))

    const transportRegion = screen
      .getByRole('heading', { name: 'Transport' })
      .closest('section')!
    expect(
      within(transportRegion).getByText('No entries this month'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('budget-chart')).toHaveTextContent(
      '"spentCents":12500',
    )
  })

  it("uses the selected month's effective limit override instead of the baseline", () => {
    const override = {
      id: 'limit-food-this-month',
      household_id: 'household-1',
      page_id: 'page-1',
      category_id: 'category-food',
      month: currentMonthKey(),
      amount: 200, // overrides food's 100 baseline for this month
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    }
    setQueries({
      categories: [food, transport],
      entries: [lunch],
      limits: [override],
    })
    render(<BudgetPageView page={page} />)

    const summary = screen.getByRole('region', { name: 'Budget summary' })
    // Total limit = 200 (food override) + 50 (transport baseline) = 250.
    expect(summary).toHaveTextContent(/250\.00/)
    // Remaining = 250 - 125 spent = 125, and food is no longer over budget.
    expect(summary).toHaveTextContent('REMAINING')
    const foodRegion = screen
      .getByRole('heading', { name: 'Food' })
      .closest('section')!
    expect(within(foodRegion).queryByText(/over/)).not.toBeInTheDocument()
    expect(within(foodRegion).getByText(/of.*200\.00/)).toBeInTheDocument()
  })

  it('changes the selected month and re-runs the entries hook with the new key', async () => {
    const user = userEvent.setup()
    setQueries({ categories: [food] })
    render(<BudgetPageView page={page} />)
    const initialMonth = currentMonthKey()

    expect(mockUseBudgetEntries).toHaveBeenLastCalledWith(
      'page-1',
      initialMonth,
    )
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(mockUseBudgetEntries).toHaveBeenLastCalledWith(
      'page-1',
      shiftMonthKey(initialMonth, -1),
    )
  })

  it('opens the category actions menu and explains cross-month cascade deletion', async () => {
    const user = userEvent.setup()
    setQueries({ categories: [food] })
    render(<BudgetPageView page={page} />)

    await user.click(screen.getByRole('button', { name: 'Actions for Food' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete category' }))

    expect(
      screen.getByRole('heading', { name: 'Delete category?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/all of its entries across every month/i),
    ).toBeInTheDocument()
  })
})
