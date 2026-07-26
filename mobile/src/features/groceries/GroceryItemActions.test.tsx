import { fireEvent, render, screen } from '@testing-library/react-native'

import { GroceryItemActions } from './GroceryItemActions'

describe('GroceryItemActions', () => {
  it('offers separate pencil and trash actions', async () => {
    const onEdit = jest.fn()
    const onDelete = jest.fn()
    await render(
      <GroceryItemActions itemName="Milk" onEdit={onEdit} onDelete={onDelete} />,
    )

    await fireEvent.press(screen.getByLabelText('Edit Milk'))
    await fireEvent.press(screen.getByLabelText('Delete Milk'))

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Edit')).toBeNull()
  })
})
