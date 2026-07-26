import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatementsTab } from '@/features/ledger/StatementsTab'
import * as statements from '@/features/ledger/statements'
import * as mutations from '@/features/ledger/statementMutations'

vi.mock('@/features/ledger/statements', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ledger/statements')>()),
  useLedgerYears: vi.fn(),
  useLedgerYearData: vi.fn(),
}))
vi.mock('@/features/ledger/statementMutations', () => ({
  createYear: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
}))

const HH = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(statements.useLedgerYears).mockReturnValue({
    data: [
      { id: 'year-2026', year: 2026, revision: 1 },
      { id: 'year-2025', year: 2025, revision: 1 },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof statements.useLedgerYears>)
})

describe('StatementsTab', () => {
  it('renders statement years newest first with independent summary controls', () => {
    render(<MemoryRouter><StatementsTab householdId={HH} /></MemoryRouter>)
    const year2026 = screen.getByText('2026')
    const year2025 = screen.getByText('2025')
    expect(
      year2026.compareDocumentPosition(year2025) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByLabelText('Toggle 2026 summary')).toBeInTheDocument()
    expect(screen.getByLabelText('Open 2026 statement')).toHaveAttribute(
      'href',
      '/ledger/year-2026',
    )
  })

  it('shows existing years as disabled in the year picker and cannot enqueue them', async () => {
    render(<MemoryRouter><StatementsTab householdId={HH} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '+ Year' }))
    const select = screen.getByLabelText('Year') as HTMLSelectElement
    const opt2026 = Array.from(select.options).find((o) => o.value === '2026')
    const opt2025 = Array.from(select.options).find((o) => o.value === '2025')
    expect(opt2026?.disabled).toBe(true)
    expect(opt2025?.disabled).toBe(true)
    expect(mutations.createYear).not.toHaveBeenCalled()
  })

  it('enqueues a fresh UUID for a new year', async () => {
    render(<MemoryRouter><StatementsTab householdId={HH} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '+ Year' }))
    const select = screen.getByLabelText('Year')
    await userEvent.selectOptions(select, '2027')
    await userEvent.click(screen.getByRole('button', { name: 'Create year' }))
    expect(mutations.createYear).toHaveBeenCalledWith(
      HH,
      expect.any(String),
      2027,
    )
  })
})
