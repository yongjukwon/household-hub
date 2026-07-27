import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { lightTokens } from '@/theme/tokens'
import { Card } from './Card'

describe('Card', () => {
  it('defaults to the glass variant using BlurView', async () => {
    const view = await render(<Card>{null}</Card>)
    const root = view.toJSON()

    expect(root).not.toBeNull()
    // The glass variant is a two-layer surface: an outer plain View carries
    // the shadow (unclipped, so the iOS shadow renders), wrapping an inner
    // BlurView that carries the glass background/border and clips its own
    // blur content to the rounded shape via overflow:'hidden'.
    expect(!Array.isArray(root) && root ? root.type : undefined).toBe('View')

    // Verify the outer View carries the shadow token, so iOS shadow rendering
    // is not suppressed by overflow:'hidden' on the same element.
    expect(StyleSheet.flatten(!Array.isArray(root) && root ? root.props.style : undefined)).toMatchObject({
      shadowColor: lightTokens.shadowCard.shadowColor,
      shadowOpacity: lightTokens.shadowCard.shadowOpacity,
      shadowRadius: lightTokens.shadowCard.shadowRadius,
      elevation: lightTokens.shadowCard.elevation,
    })

    const child =
      !Array.isArray(root) && root ? root.children?.[0] : undefined
    const blurNode =
      child && typeof child !== 'string' && !Array.isArray(child)
        ? child
        : undefined
    expect(blurNode).not.toBeUndefined()
    expect(blurNode?.type).toBe('BlurView')
    expect(StyleSheet.flatten(blurNode?.props.style)).toMatchObject({
      backgroundColor: lightTokens.glass.fill,
      borderColor: lightTokens.glass.border,
      overflow: 'hidden',
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
