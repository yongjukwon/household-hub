import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatementMonthScreen } from '@/features/ledger/StatementMonthScreen'
import { useActiveHousehold } from '@/features/household'
import * as statements from '@/features/ledger/statements'
import * as assets from '@/features/ledger/assets'

vi.mock('@/features/household', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/household')>()),
  useActiveHousehold: vi.fn(),
}))
vi.mock('@/features/ledger/statements', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ledger/statements')>()),
  useLedgerYears: vi.fn(),
  useLedgerYearData: vi.fn(),
}))
vi.mock('@/features/ledger/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ledger/assets')>()),
  useLedgerAssets: vi.fn(),
}))

const HH = '11111111-1111-4111-8111-111111111111'
const YEAR = '22222222-2222-4222-8222-222222222222'
const MONTH = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.mocked(useActiveHousehold).mockReturnValue({
    data: { id: HH, name: 'Home', members: [] },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  vi.mocked(statements.useLedgerYears).mockReturnValue({
    data: [{ id: YEAR, year: 2026, revision: 1 }],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof statements.useLedgerYears>)
  vi.mocked(statements.useLedgerYearData).mockReturnValue({
    data: {
      months: [{ id: MONTH, month: new Date().getMonth() + 1 }],
      categories: [
        {
          id: 'income-month',
          categoryId: 'salary',
          monthId: MONTH,
          name: 'Salary',
          kind: 'income',
          sortOrder: 0,
          revision: 1,
        },
        {
          id: 'spending-month',
          categoryId: 'groceries',
          monthId: MONTH,
          name: 'Groceries',
          kind: 'spending',
          sortOrder: 0,
          revision: 1,
        },
      ],
      limits: [
        {
          categoryId: 'groceries',
          monthId: MONTH,
          amountCents: 40_000,
          limitEntityId: 'limit',
          revision: 1,
        },
      ],
      transactions: [
        {
          id: 'income',
          monthId: MONTH,
          categoryId: 'salary',
          assetId: 'asset',
          kind: 'income',
          amountCents: 75_000,
          occurredAt: '2026-07-01T12:00:00Z',
          description: 'Payday',
          revision: 1,
        },
        {
          id: 'spend',
          monthId: MONTH,
          categoryId: 'groceries',
          assetId: 'asset',
          kind: 'spending',
          amountCents: 23_300,
          occurredAt: '2026-07-02T12:00:00Z',
          description: 'Market',
          revision: 1,
        },
      ],
    },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof statements.useLedgerYearData>)
  vi.mocked(assets.useLedgerAssets).mockReturnValue({
    data: [{
      id: 'asset',
      name: 'Chequing',
      kind: 'checking',
      currencyCode: 'CAD',
      balanceCents: 0,
      sortOrder: 0,
      revision: 1,
    }],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof assets.useLedgerAssets>)
})

describe('StatementMonthScreen', () => {
  it('shows monthly graphs, budget totals, and separate transaction actions', () => {
    render(
      <MemoryRouter initialEntries={[`/ledger/${YEAR}`]}>
        <Routes>
          <Route path="/ledger/:yearId" element={<StatementMonthScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Budget 2026')).toBeInTheDocument()
    expect(screen.getByText('Monthly statement')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Income' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '+ Spending' })).toBeEnabled()
    expect(screen.getByText('Payday')).toBeInTheDocument()
    expect(screen.getByText('Market')).toBeInTheDocument()
    expect(screen.getAllByText('$233.00').length).toBeGreaterThan(0)
  })
})
