import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TripScreen } from '@/features/trips/TripScreen'
import { useActiveHousehold } from '@/features/household'
import * as data from '@/features/trips/data'
import { useLedgerAssets } from '@/features/ledger/assets'
import type { Trip, TripExpense } from '@/features/trips/data'
import * as mutations from '@/features/trips/mutations'

vi.mock('@/features/household', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/household')>()),
  useActiveHousehold: vi.fn(),
}))
vi.mock('@/features/trips/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/trips/data')>()),
  useTrip: vi.fn(),
}))
vi.mock('@/features/ledger/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ledger/assets')>()),
  useLedgerAssets: vi.fn(),
}))
vi.mock('@/features/trips/mutations', () => ({
  saveTrip: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
  deleteTrip: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
  saveExpense: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
  deleteExpense: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
}))

const HH = '11111111-1111-1111-1111-111111111111'
const TRIP = '22222222-2222-2222-2222-222222222222'

const trip: Trip = {
  id: TRIP,
  name: 'Tokyo',
  destination: 'Tokyo, Japan',
  destinationCurrency: 'JPY',
  destinationTimezone: 'Asia/Tokyo',
  startDate: '2026-09-01',
  endDate: '2026-09-10',
  revision: 1,
}

function expense(over: Partial<TripExpense>): TripExpense {
  return {
    id: crypto.randomUUID(),
    tripId: TRIP,
    assetId: 'a1',
    amountCents: 0,
    currencyCode: 'JPY',
    description: 'Ramen',
    spentAt: '2026-09-02T12:00:00Z',
    revision: 1,
    ...over,
  }
}

beforeEach(() => {
  vi.mocked(useActiveHousehold).mockReturnValue({
    data: { id: HH, name: 'Home', members: [] },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  vi.mocked(useLedgerAssets).mockReturnValue({
    data: [{ id: 'a1', name: 'Travel card', kind: 'checking', currencyCode: 'CAD', balanceCents: 0, sortOrder: 0, revision: 1 }],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useLedgerAssets>)
})

function setTrip(expenses: TripExpense[]) {
  vi.mocked(data.useTrip).mockReturnValue({
    data: { trip, expenses },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof data.useTrip>)
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={[`/trips/${TRIP}`]}>
      <Routes>
        <Route path="/trips/:tripId" element={<TripScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TripScreen', () => {
  it('shows the trip header and defaults to the Expenses tab', () => {
    setTrip([expense({ currencyCode: 'JPY', amountCents: 3000_00, description: 'Ramen' })])
    renderScreen()
    expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument()
    expect(screen.getByText('Ramen')).toBeInTheDocument()
  })

  it('shows separate per-currency totals without converting', () => {
    setTrip([
      expense({ currencyCode: 'JPY', amountCents: 3000_00 }),
      expense({ currencyCode: 'CAD', amountCents: 40_00 }),
    ])
    renderScreen()
    // Both currency buckets appear; neither is converted into the other.
    expect(screen.getByText('JPY')).toBeInTheDocument()
    expect(screen.getByText('CAD')).toBeInTheDocument()
  })

  it('shows a coming-soon state for the Itinerary tab', async () => {
    setTrip([])
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Itinerary' }))
    expect(screen.getByText('Itinerary coming soon')).toBeInTheDocument()
  })

  it('opens the new-expense sheet', async () => {
    setTrip([])
    renderScreen()
    await userEvent.click(screen.getByLabelText('New expense'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('New expense')).toBeInTheDocument()
  })

  it('renames the trip inline while preserving destination setup', async () => {
    setTrip([])
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Trip name' }))
    const input = screen.getByRole('textbox', { name: 'Trip name' })
    await userEvent.clear(input)
    await userEvent.type(input, 'Japan 2026{enter}')
    expect(mutations.saveTrip).toHaveBeenCalledWith(
      HH,
      {
        id: TRIP,
        name: 'Japan 2026',
        destination: trip.destination,
        timezone: trip.destinationTimezone,
        startDate: trip.startDate,
        endDate: trip.endDate,
        destinationCurrency: trip.destinationCurrency,
      },
      trip.revision,
    )
  })
})
