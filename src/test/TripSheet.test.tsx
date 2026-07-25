import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TripSheet } from '@/features/trips/TripSheet'
import { normalizeCurrencyInput } from '@/features/trips/forms'
import * as mutations from '@/features/trips/mutations'

vi.mock('@/features/trips/mutations', () => ({
  saveTrip: vi.fn(),
  deleteTrip: vi.fn(),
}))

const HH = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(mutations.saveTrip).mockResolvedValue({
    status: 'queued',
    operationId: '11111111-1111-4111-8111-111111111111',
  })
})

describe('TripSheet', () => {
  it('normalizes manually typed currency codes', () => {
    expect(normalizeCurrencyInput(' gbp ')).toBe('GBP')
    expect(normalizeCurrencyInput('u$sd')).toBe('USD')
    expect(normalizeCurrencyInput('cadx')).toBe('CAD')
  })

  it('groups destination settings and previews the setup', async () => {
    render(
      <TripSheet open onOpenChange={vi.fn()} householdId={HH} trip={null} />,
    )
    await userEvent.type(screen.getByLabelText('Name'), 'London 2027')
    await userEvent.type(screen.getByLabelText('City or destination'), 'London')
    const currency = screen.getByLabelText('Destination currency')
    await userEvent.clear(currency)
    await userEvent.type(currency, 'gbp')
    const timezone = screen.getByLabelText('Destination timezone')
    await userEvent.clear(timezone)
    await userEvent.type(timezone, 'Europe/London')
    expect(currency).toHaveValue('GBP')
    expect(screen.getByText('London · Europe/London · GBP')).toBeInTheDocument()
  })

  it('rejects invalid ISO currency codes', async () => {
    render(
      <TripSheet open onOpenChange={vi.fn()} householdId={HH} trip={null} />,
    )
    await userEvent.type(screen.getByLabelText('Name'), 'Trip')
    await userEvent.type(screen.getByLabelText('City or destination'), 'London')
    const currency = screen.getByLabelText('Destination currency')
    await userEvent.clear(currency)
    await userEvent.type(currency, 'ZZZ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter a valid three-letter ISO currency code.')).toBeInTheDocument()
    expect(mutations.saveTrip).not.toHaveBeenCalled()
  })

  it('keeps an existing-trip form open after a discarded save', async () => {
    vi.mocked(mutations.saveTrip).mockResolvedValueOnce({
      status: 'discarded',
      operationId: '11111111-1111-4111-8111-111111111111',
      discarded: { explanation: 'Currency is locked after spending.' },
    } as Awaited<ReturnType<typeof mutations.saveTrip>>)
    const onOpenChange = vi.fn()
    render(
      <TripSheet
        open
        onOpenChange={onOpenChange}
        householdId={HH}
        trip={{
          id: 'trip',
          name: 'London',
          destination: 'London',
          destinationCurrency: 'GBP',
          destinationTimezone: 'Europe/London',
          startDate: '2027-04-21',
          endDate: '2027-04-28',
          revision: 2,
        }}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Currency is locked after spending.')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
