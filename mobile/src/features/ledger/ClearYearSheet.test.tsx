import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ClearYearSheet } from './ClearYearSheet'
import { clearYear } from './statementMutations'

jest.mock('./statementMutations', () => ({
  clearYear: jest.fn(),
}))

const mockedClearYear = clearYear as jest.MockedFunction<typeof clearYear>

describe('ClearYearSheet operation lifecycle', () => {
  it('shows a rejected deletion and keeps the typed-year form open', async () => {
    mockedClearYear.mockResolvedValue({
      status: 'discarded',
      operationId: '33333333-3333-4333-8333-333333333333',
      discarded: { explanation: 'This statement changed on another device.' },
    } as never)
    const onOpenChange = jest.fn()
    const view = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <ClearYearSheet
          open
          onOpenChange={onOpenChange}
          householdId="11111111-1111-4111-8111-111111111111"
          year={{
            id: '22222222-2222-4222-8222-222222222222',
            year: 2026,
            revision: 1,
          }}
        />
      </SafeAreaProvider>,
    )

    await fireEvent.changeText(view.getByLabelText('Confirm year'), '2026')
    await fireEvent.press(view.getByText('Delete 2026'))

    await waitFor(() => {
      expect(
        view.getByText('This statement changed on another device.'),
      ).toBeOnTheScreen()
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})

