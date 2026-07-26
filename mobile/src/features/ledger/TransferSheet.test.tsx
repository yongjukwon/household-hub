import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { TransferSheet } from './TransferSheet'
import { saveTransfer } from './assetMutations'

jest.mock('./assetMutations', () => ({
  saveTransfer: jest.fn(),
  saveSchedule: jest.fn(),
}))

const mockedSaveTransfer = saveTransfer as jest.MockedFunction<
  typeof saveTransfer
>

const assets = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Chequing',
    kind: 'checking' as const,
    currencyCode: 'CAD',
    balanceCents: 100_000,
    sortOrder: 0,
    revision: 1,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Savings',
    kind: 'savings' as const,
    currencyCode: 'CAD',
    balanceCents: 200_000,
    sortOrder: 1,
    revision: 1,
  },
]

describe('TransferSheet operation lifecycle', () => {
  it('shows a rejected transfer and keeps the form open', async () => {
    mockedSaveTransfer.mockResolvedValue({
      status: 'discarded',
      operationId: '44444444-4444-4444-8444-444444444444',
      discarded: { explanation: 'The source Asset changed.' },
    } as never)
    const onOpenChange = jest.fn()
    const view = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <TransferSheet
          open
          onOpenChange={onOpenChange}
          householdId="11111111-1111-4111-8111-111111111111"
          assets={assets}
        />
      </SafeAreaProvider>,
    )

    await fireEvent.changeText(view.getByLabelText('Amount'), '25')
    await fireEvent.press(view.getByText('Transfer'))

    await waitFor(() => {
      expect(view.getByText('The source Asset changed.')).toBeOnTheScreen()
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})

