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

    await fireEvent.press(screen.getByLabelText('Replace Ledger'))
    expect(screen.getByText('Schedule · Groceries · Notes · Trips · More')).toBeTruthy()

    await fireEvent.press(screen.getByLabelText('Save navigation'))

    await waitFor(() => expect(screen.getByText('Could not save navigation.')).toBeTruthy())
    expect(onSave).toHaveBeenCalledWith(['groceries', 'notes', 'trips'])
    expect(screen.getByText('Schedule · Groceries · Notes · Trips · More')).toBeTruthy()
  })
})
