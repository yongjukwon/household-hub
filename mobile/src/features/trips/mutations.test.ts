import { enqueueOperation } from '@/lib/operations'
import { saveExpense } from './mutations'

jest.mock('@/lib/operations', () => ({
  enqueueOperation: jest.fn().mockResolvedValue({
    status: 'queued',
    operationId: '99999999-9999-4999-8999-999999999999',
  }),
}))

const mockedEnqueue = enqueueOperation as jest.MockedFunction<
  typeof enqueueOperation
>

describe('Trip expense operations', () => {
  it('sends exactly one optional itinerary or booking link with the expense', async () => {
    await saveExpense(
      '11111111-1111-4111-8111-111111111111',
      {
        id: '22222222-2222-4222-8222-222222222222',
        tripId: '33333333-3333-4333-8333-333333333333',
        assetId: '44444444-4444-4444-8444-444444444444',
        amountCents: 5_000,
        currency: 'gbp',
        spentAt: '2027-04-22T12:00:00.000Z',
        description: 'Tower ticket',
        itineraryEntryId: '55555555-5555-4555-8555-555555555555',
        bookingEntryId: null,
      },
      null,
    )

    expect(mockedEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'trip.expense.upsert',
        payload: expect.objectContaining({
          itineraryEntryId: '55555555-5555-4555-8555-555555555555',
          bookingEntryId: null,
        }),
      }),
    )
  })
})
