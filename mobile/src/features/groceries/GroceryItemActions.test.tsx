import { fireEvent, render, screen } from '@testing-library/react-native'

import { GroceryItemActions } from './GroceryItemActions'

describe('GroceryItemActions', () => {
  it('offers separate history, pencil and trash actions', async () => {
    const onHistory = jest.fn()
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    await render(
      <GroceryItemActions itemName="Milk" onHistory={onHistory} onEdit={onEdit} onDelete={onDelete} />,
    )

    await fireEvent.press(screen.getByLabelText('Edit Milk'))
    await fireEvent.press(screen.getByLabelText('Delete Milk'))
    await fireEvent.press(screen.getByLabelText('Price history for Milk'))

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onHistory).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Edit')).toBeNull()
  })
})
