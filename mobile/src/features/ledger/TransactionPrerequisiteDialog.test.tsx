import { fireEvent, render } from '@testing-library/react-native'

import { TransactionPrerequisiteDialog } from './TransactionPrerequisiteDialog'

describe('TransactionPrerequisiteDialog', () => {
  it('explains the Asset requirement and exposes a create action', async () => {
    const onContinue = jest.fn()
    const view = await render(
      <TransactionPrerequisiteDialog
        open
        prerequisite="asset"
        kind="income"
        onOpenChange={jest.fn()}
        onContinue={onContinue}
      />,
    )

    expect(view.getByText(/linked to a CAD Asset/)).toBeTruthy()
    await fireEvent.press(view.getByText('Create Asset'))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('offers category creation for the requested transaction kind', async () => {
    const onContinue = jest.fn()
    const view = await render(
      <TransactionPrerequisiteDialog
        open
        prerequisite="category"
        kind="spending"
        onOpenChange={jest.fn()}
        onContinue={onContinue}
      />,
    )

    expect(view.getByText(/Create a spending category/)).toBeTruthy()
    await fireEvent.press(view.getByText('Create Category'))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
