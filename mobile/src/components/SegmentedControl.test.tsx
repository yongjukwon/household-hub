import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { darkTokens } from '@/theme/tokens'
import { SegmentedControl } from './SegmentedControl'

jest.mock('@/theme/tokens', () => {
  const actual = jest.requireActual('@/theme/tokens')
  return {
    ...actual,
    useTheme: () => ({ tokens: actual.darkTokens, scheme: 'dark' }),
  }
})

describe('SegmentedControl', () => {
  it('raises the active segment above its dark track', async () => {
    await render(
      <SegmentedControl
        label="Ledger view"
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'budget', label: 'Budget' },
        ]}
        value="overview"
        onChange={jest.fn()}
      />,
    )

    expect(
      StyleSheet.flatten(screen.getByLabelText('Ledger view').props.style)
        .backgroundColor,
    ).toBe(darkTokens.cardAlt)
    expect(
      StyleSheet.flatten(
        screen.getByRole('radio', { name: 'Overview' }).props.style,
      ).backgroundColor,
    ).toBe(darkTokens.control)
  })
})
