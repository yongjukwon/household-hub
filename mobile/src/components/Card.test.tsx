import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { lightTokens } from '@/theme/tokens'
import { Card } from './Card'

describe('Card', () => {
  it('defaults to the glass variant using BlurView', async () => {
    const view = await render(<Card>{null}</Card>)
    const root = view.toJSON()

    expect(root).not.toBeNull()
    expect(!Array.isArray(root) && root ? root.type : undefined).toBe('BlurView')
    expect(
      StyleSheet.flatten(
        !Array.isArray(root) && root ? root.props.style : undefined,
      ),
    ).toMatchObject({
      backgroundColor: lightTokens.glass.fill,
      borderColor: lightTokens.glass.border,
    })
  })

  it('renders a flat translucent surface for the row variant', async () => {
    const view = await render(<Card variant="row">{null}</Card>)
    const root = view.toJSON()

    expect(root).not.toBeNull()
    expect(!Array.isArray(root) && root ? root.type : undefined).toBe('View')
    expect(
      StyleSheet.flatten(
        !Array.isArray(root) && root ? root.props.style : undefined,
      ),
    ).toMatchObject({
      backgroundColor: lightTokens.row.fill,
      borderColor: lightTokens.row.border,
    })
  })
})
