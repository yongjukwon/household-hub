import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { TripSheet } from './TripSheet'
import { saveTrip } from './mutations'

jest.mock('./mutations', () => ({
  saveTrip: jest.fn(),
  deleteTrip: jest.fn(),
}))

jest.mock('@/lib/uuid', () => ({
  newUuid: () => '22222222-2222-4222-8222-222222222222',
}))

const mockedSaveTrip = saveTrip as jest.MockedFunction<typeof saveTrip>

describe('TripSheet date-range integration', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 6, 26, 12, 0))
    mockedSaveTrip.mockReset()
    mockedSaveTrip.mockResolvedValue({
      status: 'queued',
      operationId: '99999999-9999-4999-8999-999999999999',
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('defaults to tomorrow and submits both dates chosen in one calendar', async () => {
    const onOpenChange = jest.fn()
    const view = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <TripSheet
          open
          onOpenChange={onOpenChange}
          householdId="11111111-1111-4111-8111-111111111111"
          trip={null}
        />
      </SafeAreaProvider>,
    )

    expect(view.getByText('Jul 26, 2026 – Jul 27, 2026')).toBeOnTheScreen()

    await fireEvent.changeText(view.getByLabelText('Name'), 'London 2027')
    await fireEvent.changeText(
      view.getByLabelText('City or destination'),
      'London',
    )
    await fireEvent.press(view.getByLabelText('Trip dates'))
    await fireEvent.press(view.getByLabelText('Select July 30, 2026'))
    await fireEvent.press(view.getByLabelText('Next month'))
    await fireEvent.press(view.getByLabelText('Select August 2, 2026'))
    await fireEvent.press(view.getByRole('button', { name: 'Done' }))
    await fireEvent.press(view.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockedSaveTrip).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        expect.objectContaining({
          id: '22222222-2222-4222-8222-222222222222',
          name: 'London 2027',
          destination: 'London',
          startDate: '2026-07-30',
          endDate: '2026-08-02',
        }),
        null,
      )
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
