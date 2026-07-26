import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import TripsScreen from '../../../app/(tabs)/trips'
import { useActiveHousehold } from '@/features/household'
import { deleteTrip } from './mutations'
import { useTrips } from './data'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/features/household', () => ({
  useActiveHousehold: jest.fn(),
}))

jest.mock('./data', () => ({
  useTrips: jest.fn(),
}))

jest.mock('./mutations', () => ({
  deleteTrip: jest.fn(),
}))

jest.mock('./TripSheet', () => ({
  TripSheet: () => null,
}))

const mockedHousehold = useActiveHousehold as jest.MockedFunction<
  typeof useActiveHousehold
>
const mockedTrips = useTrips as jest.MockedFunction<typeof useTrips>
const mockedDeleteTrip = deleteTrip as jest.MockedFunction<typeof deleteTrip>

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <TripsScreen />
    </SafeAreaProvider>,
  )
}

beforeEach(() => {
  mockedDeleteTrip.mockReset()
  mockedHousehold.mockReturnValue({
    data: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Rabbit and Penguin',
      members: [],
    },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  mockedTrips.mockReturnValue({
    data: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'London',
        destination: 'London, UK',
        destinationCurrency: 'GBP',
        destinationTimezone: 'Europe/London',
        startDate: '2027-04-21',
        endDate: '2027-04-28',
        revision: 1,
      },
    ],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useTrips>)
})

describe('Trips index operation lifecycle', () => {
  it('closes the deletion confirmation after the operation is accepted', async () => {
    mockedDeleteTrip.mockResolvedValue({
      status: 'queued',
      operationId: '33333333-3333-4333-8333-333333333333',
    })
    const view = await renderScreen()

    await fireEvent.press(view.getByLabelText('Delete London'))
    await waitFor(() => {
      expect(view.getByText('Delete London?')).toBeOnTheScreen()
    })
    await fireEvent.press(view.getByText('Delete'))

    await waitFor(() => {
      expect(view.queryByText('Delete London?')).toBeNull()
    })
  })

  it('keeps the confirmation open and explains a thrown queue failure', async () => {
    mockedDeleteTrip.mockRejectedValue(
      new Error('baseRevision must be a revision of at least 1, got undefined'),
    )
    const view = await renderScreen()

    await fireEvent.press(view.getByLabelText('Delete London'))
    await waitFor(() => {
      expect(view.getByText('Delete London?')).toBeOnTheScreen()
    })
    await fireEvent.press(view.getByText('Delete'))

    await waitFor(() => {
      expect(
        view.getByText('This item is out of date. Refresh it and try again.'),
      ).toBeOnTheScreen()
    })
    expect(view.getByText('Delete London?')).toBeOnTheScreen()
  })
})
