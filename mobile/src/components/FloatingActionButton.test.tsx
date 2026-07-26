import { fireEvent, render, screen } from '@testing-library/react-native'

import { FloatingActionButton } from './FloatingActionButton'

describe('FloatingActionButton', () => {
  it('exposes the supplied action label and invokes it from a phone-sized target', async () => {
    const onPress = jest.fn()
    await render(<FloatingActionButton accessibilityLabel="New event" onPress={onPress} />)

    const button = screen.getByLabelText('New event')
    expect(button.props.accessibilityState).toEqual({ disabled: false })
    expect(button.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 54, height: 54, position: 'absolute' }),
      ]),
    )

    await fireEvent.press(button)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
