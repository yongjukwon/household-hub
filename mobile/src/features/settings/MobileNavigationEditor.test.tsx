import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { MobileNavigationEditor } from './MobileNavigationEditor'

describe('MobileNavigationEditor', () => {
  it('keeps the draft available and explains a failed save', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('offline'))
    await render(
      <MobileNavigationEditor
        value={['groceries', 'ledger', 'trips']}
        saving={false}
        onSave={onSave}
      />,
    )

    await fireEvent.press(screen.getByLabelText('Swap Ledger with Notes'))

    await fireEvent.press(screen.getByLabelText('Save navigation'))

    await waitFor(() => expect(screen.getByText('Could not save navigation.')).toBeTruthy())
    expect(onSave).toHaveBeenCalledWith(['groceries', 'notes', 'trips'])
  })
})
