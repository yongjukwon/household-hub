import { fireEvent, render } from '@testing-library/react-native'

import { DetailListRow } from './DetailListRow'

describe('DetailListRow', () => {
  it('keeps navigation and deletion as independent actions', async () => {
    const onOpen = jest.fn()
    const onDelete = jest.fn()
    const view = await render(
      <DetailListRow
        title="Costco"
        openLabel="Open Costco"
        deleteLabel="Delete Costco"
        onOpen={onOpen}
        onDelete={onDelete}
      />,
    )

    await fireEvent.press(view.getByLabelText('Delete Costco'))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()

    await fireEvent.press(view.getByLabelText('Open Costco'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
