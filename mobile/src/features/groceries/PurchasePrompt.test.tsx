import { fireEvent, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { PurchasePrompt } from './PurchasePrompt'
import type { GroceryItem } from './data'

const item: GroceryItem = {
  id: '33333333-3333-4333-8333-333333333333',
  listId: '22222222-2222-4222-8222-222222222222',
  name: 'Milk',
  quantity: null,
  checked: false,
  checkedAt: null,
  unitPriceCents: null,
  purchaseQuantity: null,
  totalPriceCents: null,
  purchaseOccurrenceId: null,
  sortOrder: 0,
  revision: 1,
}

async function renderPrompt(overrides: Partial<React.ComponentProps<typeof PurchasePrompt>> = {}) {
  const props: React.ComponentProps<typeof PurchasePrompt> = {
    item,
    onCancel: jest.fn(),
    onSavePrice: jest.fn(),
    onCheckWithoutPrice: jest.fn(),
    ...overrides,
  }
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <PurchasePrompt {...props} />
    </SafeAreaProvider>,
  )
  return props
}

describe('PurchasePrompt', () => {
  it('accepts a positive decimal quantity and sends the total paid in cents', async () => {
    const props = await renderPrompt()

    await fireEvent.changeText(screen.getByLabelText('Purchase quantity'), '2.5')
    await fireEvent.changeText(screen.getByLabelText('Purchase price'), '12.50')
    await fireEvent.press(screen.getByText('Save price and check'))

    expect(props.onSavePrice).toHaveBeenCalledWith(2.5, 1250)
  })

  it('rejects zero quantity and a non-positive total', async () => {
    const props = await renderPrompt()

    await fireEvent.changeText(screen.getByLabelText('Purchase quantity'), '0')
    await fireEvent.changeText(screen.getByLabelText('Purchase price'), '12.50')
    await fireEvent.press(screen.getByText('Save price and check'))
    expect(screen.getByText('Quantity must be a positive number.')).toBeOnTheScreen()

    await fireEvent.changeText(screen.getByLabelText('Purchase quantity'), '1')
    await fireEvent.changeText(screen.getByLabelText('Purchase price'), '0')
    await fireEvent.press(screen.getByText('Save price and check'))
    expect(screen.getByText('Price must be greater than zero.')).toBeOnTheScreen()
    expect(props.onSavePrice).not.toHaveBeenCalled()
  })

  it('rejects a negative raw total instead of stripping its sign', async () => {
    const props = await renderPrompt()

    await fireEvent.changeText(screen.getByLabelText('Purchase quantity'), '2')
    await fireEvent.changeText(screen.getByLabelText('Purchase price'), '-12.50')
    await fireEvent.press(screen.getByText('Save price and check'))

    expect(screen.getByText('Price must be greater than zero.')).toBeOnTheScreen()
    expect(props.onSavePrice).not.toHaveBeenCalled()
  })

  it('offers both an unpriced check and cancellation without recording a price', async () => {
    const props = await renderPrompt()

    await fireEvent.press(screen.getByText('Check without price'))
    await fireEvent.press(screen.getByText('Cancel'))

    expect(props.onCheckWithoutPrice).toHaveBeenCalledTimes(1)
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onSavePrice).not.toHaveBeenCalled()
  })
})
