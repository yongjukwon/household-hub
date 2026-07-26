import { fireEvent, render, screen } from '@testing-library/react-native'

import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('blocks repeated confirmation while an action is already running', async () => {
    const onConfirm = jest.fn()
    await render(
      <ConfirmDialog
        open
        onOpenChange={jest.fn()}
        title="Delete Milk?"
        description="This permanently removes the item."
        confirmLabel="Delete"
        confirmDisabled
        onConfirm={onConfirm}
      />,
    )

    await fireEvent.press(screen.getByText('Delete'))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
