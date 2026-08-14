import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ItemSheet } from './ItemSheet'
import type { GroceryItem } from './data'
import { saveGroceryItem } from './mutations'

jest.mock('./mutations', () => ({
  saveGroceryItem: jest.fn(),
}))

const mockedSaveItem = saveGroceryItem as jest.MockedFunction<typeof saveGroceryItem>

const item: GroceryItem = {
  id: '33333333-3333-4333-8333-333333333333',
  listId: '22222222-2222-4222-8222-222222222222',
  name: 'Coffee',
  quantity: '2.5',
  checked: false,
  checkedAt: null,
  unitPriceCents: 500,
  purchaseQuantity: 2.5,
  totalPriceCents: 1250,
  purchaseOccurrenceId: '44444444-4444-4444-8444-444444444444',
  sortOrder: 3,
  revision: 4,
}

async function renderSheet(onOpenChange = jest.fn()) {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <ItemSheet
        open
        onOpenChange={onOpenChange}
        householdId="11111111-1111-4111-8111-111111111111"
        listId={item.listId}
        item={item}
        sortOrder={item.sortOrder}
      />
    </SafeAreaProvider>,
  )
}

beforeEach(() => {
  mockedSaveItem.mockReset().mockResolvedValue({
    status: 'queued',
    operationId: '55555555-5555-4555-8555-555555555555',
  })
})

describe('ItemSheet purchase fields', () => {
  it('preserves quantity and total, then recalculates the unit price from edits', async () => {
    const onOpenChange = jest.fn()
    await renderSheet(onOpenChange)

    expect(screen.getByLabelText('Quantity')).toHaveDisplayValue('2.5')
    expect(screen.getByLabelText('Price')).toHaveDisplayValue('12.50')

    await fireEvent.changeText(screen.getByLabelText('Quantity'), '4')
    await fireEvent.changeText(screen.getByLabelText('Price'), '10.00')
    await fireEvent.press(screen.getByText('Save'))

    await waitFor(() => expect(mockedSaveItem).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        quantity: '4',
        purchaseQuantity: 4,
        totalPriceCents: 1000,
        unitPriceCents: 250,
        purchaseOccurrenceId: item.purchaseOccurrenceId,
      }),
      4,
    ))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not save malformed quantity or a non-positive total', async () => {
    await renderSheet()

    await fireEvent.changeText(screen.getByLabelText('Quantity'), '-2')
    await fireEvent.press(screen.getByText('Save'))
    expect(screen.getByText('Quantity must be a positive number.')).toBeOnTheScreen()

    await fireEvent.changeText(screen.getByLabelText('Quantity'), '2')
    await fireEvent.changeText(screen.getByLabelText('Price'), '0')
    await fireEvent.press(screen.getByText('Save'))
    expect(screen.getByText('Price must be greater than zero.')).toBeOnTheScreen()
    expect(mockedSaveItem).not.toHaveBeenCalled()
  })
})
