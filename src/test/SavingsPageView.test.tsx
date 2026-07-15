import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SavingsPageView } from '@/components/savings/SavingsPageView'
import {
  useCatchUpAutoDeposits,
  useCreateSavingsTransaction,
  useDeleteSavingsSource,
  useSavingsDepositRules,
  useSavingsSources,
  useSavingsTransactions,
} from '@/hooks/useSavings'
import { useHousehold } from '@/hooks/useHousehold'

vi.mock('@/hooks/useSavings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useSavings')>()
  return {
    ...actual,
    useSavingsSources: vi.fn(),
    useSavingsTransactions: vi.fn(),
    useSavingsDepositRules: vi.fn(),
    useCatchUpAutoDeposits: vi.fn(),
    useCreateSavingsSource: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useRenameSavingsSource: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useDeleteSavingsSource: vi.fn(),
    useCreateSavingsTransaction: vi.fn(),
    useUpdateSavingsTransaction: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useDeleteSavingsTransaction: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useSaveSavingsDepositRule: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useDeleteSavingsDepositRule: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
  }
})

vi.mock('@/hooks/useHousehold', () => ({
  useHousehold: vi.fn(),
}))

vi.mock('@/hooks/useRealtimeTable', () => ({
  useRealtimeTable: vi.fn(),
}))

const mockUseSavingsSources = vi.mocked(useSavingsSources)
const mockUseSavingsTransactions = vi.mocked(useSavingsTransactions)
const mockUseSavingsDepositRules = vi.mocked(useSavingsDepositRules)
const mockUseCatchUpAutoDeposits = vi.mocked(useCatchUpAutoDeposits)
const mockUseDeleteSavingsSource = vi.mocked(useDeleteSavingsSource)
const mockUseCreateSavingsTransaction = vi.mocked(useCreateSavingsTransaction)
const mockUseHousehold = vi.mocked(useHousehold)

const refetchSources = vi.fn()
const deleteSource = vi.fn()
const createTransaction = vi.fn()

const tfsa = {
  id: 'source-tfsa',
  household_id: 'household-1',
  name: 'TFSA — Wealthsimple',
  amount: 12500.75,
  sort_order: 0,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
}

const hisa = {
  ...tfsa,
  id: 'source-hisa',
  name: 'HISA',
  amount: 4000,
}

const paycheckRule = {
  id: 'rule-1',
  household_id: 'household-1',
  source_id: 'source-tfsa',
  amount: 300,
  day_of_month_1: 1,
  day_of_month_2: 15,
  start_date: '2026-07-01',
  active: true,
  last_generated_date: null,
  description: 'Paycheck',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
}

function queryResult(
  data: unknown,
  options: { isPending?: boolean; isError?: boolean } = {},
) {
  return {
    data,
    isPending: options.isPending ?? false,
    isError: options.isError ?? false,
    refetch: refetchSources,
  }
}

function setSources(
  sources: unknown[] = [],
  options: { isPending?: boolean; isError?: boolean } = {},
) {
  mockUseSavingsSources.mockReturnValue(queryResult(sources, options) as never)
}

describe('SavingsPageView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSources()
    mockUseSavingsTransactions.mockReturnValue(queryResult([]) as never)
    mockUseSavingsDepositRules.mockReturnValue(queryResult([]) as never)
    mockUseCatchUpAutoDeposits.mockReturnValue(undefined)
    mockUseHousehold.mockReturnValue({
      data: { id: 'household-1', name: 'Our Household', members: [] },
    } as never)
    mockUseDeleteSavingsSource.mockReturnValue({
      mutateAsync: deleteSource,
    } as never)
    mockUseCreateSavingsTransaction.mockReturnValue({
      isPending: false,
      mutateAsync: createTransaction,
    } as never)
  })

  it('renders loading, retryable error, and empty states', () => {
    setSources([], { isPending: true })
    const { unmount } = render(<SavingsPageView />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading savings…')
    unmount()

    setSources([], { isError: true })
    const second = render(<SavingsPageView />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      /couldn.t load your savings/i,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetchSources).toHaveBeenCalledOnce()
    second.unmount()

    setSources([])
    render(<SavingsPageView />)
    expect(
      screen.getByRole('heading', { name: 'Track where your savings live' }),
    ).toBeInTheDocument()
  })

  it('runs the auto-deposit catch-up on mount', () => {
    render(<SavingsPageView />)
    expect(mockUseCatchUpAutoDeposits).toHaveBeenCalled()
  })

  it('shows sources with balances, the household total, and any auto-deposit summary', () => {
    setSources([tfsa, hisa])
    mockUseSavingsDepositRules.mockImplementation(
      (sourceId: string) =>
        queryResult(sourceId === 'source-tfsa' ? [paycheckRule] : []) as never,
    )
    render(<SavingsPageView />)

    expect(screen.getByText(/16,500\.75/)).toBeInTheDocument() // total
    expect(screen.getByText(/across 2 sources/)).toBeInTheDocument()
    const tfsaCard = screen
      .getByRole('heading', { name: 'TFSA — Wealthsimple' })
      .closest('section')!
    expect(within(tfsaCard).getByText(/12,500\.75/)).toBeInTheDocument()
    expect(
      within(tfsaCard).getByText(/300\.00 on the 1st and 15th/),
    ).toBeInTheDocument()
  })

  it('opens the withdrawal dialog from the card menu and requires a reason', async () => {
    const user = userEvent.setup()
    setSources([tfsa])
    render(<SavingsPageView />)

    await user.click(
      screen.getByRole('button', { name: 'Actions for TFSA — Wealthsimple' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Add withdrawal' }))
    expect(
      screen.getByRole('heading', { name: 'Withdrawal' }),
    ).toBeInTheDocument()

    // Amount without a reason: blocked with a validation message.
    await user.type(screen.getByLabelText('Amount'), '500')
    fireEvent.submit(screen.getByLabelText('Amount').closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /what the withdrawal was for/i,
    )
    expect(createTransaction).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('For what'), 'Car repair')
    fireEvent.submit(screen.getByLabelText('Amount').closest('form')!)
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 'source-tfsa',
        type: 'withdrawal',
        amount: 500,
        reason: 'Car repair',
      }),
    )
  })

  it('opens the deposit dialog without requiring a note', async () => {
    const user = userEvent.setup()
    setSources([tfsa])
    createTransaction.mockResolvedValue({})
    render(<SavingsPageView />)

    await user.click(
      screen.getByRole('button', { name: 'Actions for TFSA — Wealthsimple' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Add deposit' }))
    await user.type(screen.getByLabelText('Amount'), '300')
    fireEvent.submit(screen.getByLabelText('Amount').closest('form')!)

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'deposit',
        amount: 300,
        reason: null,
      }),
    )
  })

  it('confirms source deletion with cascade copy', async () => {
    const user = userEvent.setup()
    setSources([tfsa])
    render(<SavingsPageView />)

    await user.click(
      screen.getByRole('button', { name: 'Actions for TFSA — Wealthsimple' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Delete source' }))
    expect(
      screen.getByRole('heading', { name: 'Delete source?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/deposit\/withdrawal history and auto-deposit rule/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteSource).toHaveBeenCalledWith('source-tfsa')
  })

  it('opens the transaction history from the card menu', async () => {
    const user = userEvent.setup()
    setSources([tfsa])
    mockUseSavingsTransactions.mockReturnValue(
      queryResult([
        {
          id: 'txn-1',
          household_id: 'household-1',
          source_id: 'source-tfsa',
          type: 'withdrawal',
          amount: 500,
          reason: 'Car repair',
          occurred_at: '2026-07-10',
          created_by: 'user-1',
          auto_deposit_rule_id: null,
          created_at: '2026-07-10T00:00:00.000Z',
          updated_at: '2026-07-10T00:00:00.000Z',
        },
      ]) as never,
    )
    render(<SavingsPageView />)

    await user.click(
      screen.getByRole('button', { name: 'Actions for TFSA — Wealthsimple' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'View history' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Car repair')).toBeInTheDocument()
    expect(within(dialog).getByText(/−.*500\.00/)).toBeInTheDocument()
  })
})
