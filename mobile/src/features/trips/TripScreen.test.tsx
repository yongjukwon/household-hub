import { fireEvent, render } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import TripScreen from '../../../app/(tabs)/trips/[tripId]'
import { useActiveHousehold } from '@/features/household'
import { useLedgerAssets } from '@/features/ledger/assets'
import { useTrip } from './data'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    tripId: '22222222-2222-4222-8222-222222222222',
  }),
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
}))

jest.mock('@/features/household', () => ({
  useActiveHousehold: jest.fn(),
}))

jest.mock('@/features/ledger/assets', () => ({
  useLedgerAssets: jest.fn(),
}))

jest.mock('./data', () => {
  const actual = jest.requireActual('./data')
  return {
    ...actual,
    useTrip: jest.fn(),
  }
})

const mockedHousehold = useActiveHousehold as jest.MockedFunction<
  typeof useActiveHousehold
>
const mockedAssets = useLedgerAssets as jest.MockedFunction<
  typeof useLedgerAssets
>
const mockedTrip = useTrip as jest.MockedFunction<typeof useTrip>

beforeEach(() => {
  mockedHousehold.mockReturnValue({
    data: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Rabbit and Penguin',
      members: [],
    },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  mockedAssets.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useLedgerAssets>)
  mockedTrip.mockReturnValue({
    data: {
      trip: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'London 2027',
        destination: 'London, UK',
        destinationCurrency: 'GBP',
        destinationTimezone: 'Europe/London',
        startDate: '2027-04-21',
        endDate: '2027-04-28',
        revision: 1,
      },
      itinerary: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          tripId: '22222222-2222-4222-8222-222222222222',
          itemDate: '2027-04-21',
          startTime: '09:30',
          title: 'Tower of London tour',
          notes: null,
          sortOrder: 0,
          revision: 1,
        },
      ],
      bookings: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          tripId: '22222222-2222-4222-8222-222222222222',
          kind: 'hotel',
          title: 'London hotel',
          confirmationNumber: 'ABC123',
          address: null,
          startsAt: '2027-04-21T14:00:00.000Z',
          endsAt: null,
          notes: null,
          sortOrder: 0,
          revision: 1,
        },
      ],
      checklist: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          tripId: '22222222-2222-4222-8222-222222222222',
          label: 'Passports',
          checked: false,
          sortOrder: 0,
          revision: 1,
        },
      ],
      expenses: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          tripId: '22222222-2222-4222-8222-222222222222',
          assetId: '77777777-7777-4777-8777-777777777777',
          amountCents: 2_500,
          currencyCode: 'GBP',
          description: 'Museum',
          spentAt: '2027-04-22T12:00:00.000Z',
          itineraryEntryId: null,
          bookingEntryId: null,
          revision: 1,
        },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useTrip>)
})

describe('native Trip detail', () => {
  it('defaults to Itinerary and exposes the real four trip sections', async () => {
    const view = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <TripScreen />
      </SafeAreaProvider>,
    )

    expect(view.getByText('Tower of London tour')).toBeOnTheScreen()
    expect(view.queryByText(/coming soon/i)).not.toBeOnTheScreen()

    await fireEvent.press(view.getByText('Bookings'))
    expect(view.getByText('London hotel')).toBeOnTheScreen()

    await fireEvent.press(view.getByText('Checklist'))
    expect(view.getByText('Passports')).toBeOnTheScreen()

    await fireEvent.press(view.getByText('Expenses'))
    expect(view.getByText('Museum')).toBeOnTheScreen()
  })
})
