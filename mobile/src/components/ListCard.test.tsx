import { render } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'

import { lightTokens } from '@/theme/tokens'
import { ListCard } from './ListCard'

describe('ListCard', () => {
  it('uses the Ledger segmented-control radius for list surfaces', async () => {
    const view = await render(
      <ListCard>
        <Text>Calendar event</Text>
      </ListCard>,
    )
    const tree = view.toJSON()

    expect(tree).not.toBeNull()
    expect(
      StyleSheet.flatten(
        !Array.isArray(tree) && tree ? tree.props.style : undefined,
      ).borderRadius,
    ).toBe(lightTokens.radiusControl)
  })
})
