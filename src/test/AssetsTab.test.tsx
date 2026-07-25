import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetsTab } from '@/features/ledger/AssetsTab'
import * as assets from '@/features/ledger/assets'
import * as mutations from '@/features/ledger/assetMutations'
import type { LedgerAsset, LedgerTransfer, TransferSchedule } from '@/features/ledger/assets'

vi.mock('@/features/ledger/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ledger/assets')>()),
  useLedgerAssets: vi.fn(),
  useLedgerTransfers: vi.fn(),
  useTransferSchedules: vi.fn(),
}))
vi.mock('@/features/ledger/assetMutations', () => ({
  saveAsset: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'o' }),
  deleteAsset: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'o' }),
  saveTransfer: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'o' }),
  deleteTransfer: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'o' }),
  saveSchedule: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'o' }),
  deleteSchedule: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'o' }),
  toggleSchedule: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'o' }),
}))

const HH = '11111111-1111-1111-1111-111111111111'

function asset(over: Partial<LedgerAsset>): LedgerAsset {
  return {
    id: crypto.randomUUID(),
    name: 'Chequing',
    kind: 'checking',
    currencyCode: 'CAD',
    balanceCents: 0,
    sortOrder: 0,
    revision: 1,
    ...over,
  }
}

function setData(
  a: LedgerAsset[],
  t: LedgerTransfer[] = [],
  s: TransferSchedule[] = [],
) {
  vi.mocked(assets.useLedgerAssets).mockReturnValue({
    data: a,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof assets.useLedgerAssets>)
  vi.mocked(assets.useLedgerTransfers).mockReturnValue({
    data: t,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof assets.useLedgerTransfers>)
  vi.mocked(assets.useTransferSchedules).mockReturnValue({
    data: s,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof assets.useTransferSchedules>)
}

beforeEach(() => vi.clearAllMocks())

describe('AssetsTab', () => {
  it('shows the CAD household total from CAD assets only', () => {
    setData([
      asset({ name: 'Chequing', currencyCode: 'CAD', balanceCents: 60_00 }),
      asset({ name: 'Savings', currencyCode: 'CAD', balanceCents: 40_00 }),
      asset({ name: 'US Cash', currencyCode: 'USD', balanceCents: 500_00 }),
    ])
    render(<AssetsTab householdId={HH} />)
    expect(screen.getByText('Household total')).toBeInTheDocument()
    // 60 + 40 CAD = 100; the USD asset is excluded from the CAD total.
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    // Foreign subtotal shown separately (never converted): the 500.00 appears
    // both as the USD asset row and as the foreign-currency subtotal.
    expect(screen.getAllByText(/500\.00/).length).toBeGreaterThanOrEqual(2)
  })

  it('disables transfer creation with fewer than two assets', () => {
    setData([asset({})])
    render(<AssetsTab householdId={HH} />)
    expect(screen.getByLabelText('New transfer')).toBeDisabled()
  })

  it('toggles a recurring transfer active state', async () => {
    const a1 = asset({ name: 'A' })
    const a2 = asset({ name: 'B' })
    const schedule: TransferSchedule = {
      id: 's1',
      fromAssetId: a1.id,
      toAssetId: a2.id,
      amountCents: 25_00,
      frequency: 'monthly',
      startsAt: '2026-07-01T12:00:00Z',
      timezone: 'America/Toronto',
      active: true,
      revision: 1,
    }
    setData([a1, a2], [], [schedule])
    render(<AssetsTab householdId={HH} />)
    await userEvent.click(screen.getByLabelText('Pause recurring transfer'))
    expect(mutations.toggleSchedule).toHaveBeenCalledWith(HH, schedule, false)
  })
})
