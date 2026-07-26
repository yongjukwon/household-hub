import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { lightTokens } from '@/theme/tokens'
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

    const tree = view.toJSON()
    expect(tree).not.toBeNull()
    expect(
      StyleSheet.flatten(
        !Array.isArray(tree) && tree ? tree.props.style : undefined,
      ).borderRadius,
    ).toBe(lightTokens.radiusControl)
  })
})
