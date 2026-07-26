import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ExpenseSheet } from '@/features/trips/ExpenseSheet'
import { compatibleExpenseAssets } from '@/features/trips/forms'
import type { LedgerAsset } from '@/features/ledger/assets'
import type { Trip } from '@/features/trips/data'

vi.mock('@/features/trips/mutations', () => ({
  saveExpense: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
  deleteExpense: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
}))

const assets: LedgerAsset[] = [
  { id: 'cad', name: 'CAD card', kind: 'credit', currencyCode: 'CAD', balanceCents: 0, sortOrder: 0, revision: 1 },
  { id: 'gbp', name: 'GBP cash', kind: 'cash', currencyCode: 'GBP', balanceCents: 0, sortOrder: 1, revision: 1 },
]
const trip: Trip = {
  id: 'trip',
  name: 'London',
  destination: 'London',
  destinationCurrency: 'GBP',
  destinationTimezone: 'Europe/London',
  startDate: '2027-04-21',
  endDate: '2027-04-28',
  revision: 1,
}

function renderSheet(sourceAssets = assets, sourceTrip = trip) {
  return render(
    <MemoryRouter>
      <ExpenseSheet
        open
        onOpenChange={vi.fn()}
        householdId="hh"
        trip={sourceTrip}
        assets={sourceAssets}
        expense={null}
        itinerary={[]}
        bookings={[]}
      />
    </MemoryRouter>,
  )
}

describe('ExpenseSheet', () => {
  it('filters Assets to the selected currency', async () => {
    expect(compatibleExpenseAssets(assets, 'GBP')).toEqual([assets[1]])
    renderSheet()
    expect(screen.getByRole('option', { name: 'GBP cash' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'CAD card' })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'CAD')
    expect(screen.getByRole('option', { name: 'CAD card' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'GBP cash' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Paid from')).toHaveValue('cad')
  })

  it('dedupes CAD when it is also the destination currency', () => {
    renderSheet(assets, { ...trip, destinationCurrency: 'CAD' })
    expect(screen.getAllByRole('option', { name: 'CAD' })).toHaveLength(1)
  })

  it('links to Ledger Assets and disables Save when no matching Asset exists', () => {
    renderSheet([assets[0]])
    expect(screen.getByText('No GBP Asset is available.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a GBP Asset' })).toHaveAttribute(
      'href',
      '/ledger?segment=assets',
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
