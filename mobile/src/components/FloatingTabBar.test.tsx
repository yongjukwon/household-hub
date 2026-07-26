import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { FloatingTabBar, TAB_BAR_FLOAT_OFFSET, TAB_BAR_HEIGHT } from './FloatingTabBar'

const mockedReplace = jest.fn()

jest.mock('expo-router', () => ({
  usePathname: () => '/ledger',
  useRouter: () => ({ replace: mockedReplace }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

describe('FloatingTabBar', () => {
  beforeEach(() => {
    mockedReplace.mockReset()
  })

  it('floats above the bottom edge as a glass pill, not docked flush', async () => {
    const view = await render(<FloatingTabBar />)
    const root = view.toJSON()

    expect(root).not.toBeNull()
    expect(!Array.isArray(root) && root ? root.type : undefined).toBe('BlurView')
    expect(
      StyleSheet.flatten(!Array.isArray(root) && root ? root.props.style : undefined),
    ).toMatchObject({
      position: 'absolute',
      bottom: TAB_BAR_FLOAT_OFFSET,
      height: TAB_BAR_HEIGHT,
    })
  })

  it('marks the active destination selected and navigates on press', async () => {
    await render(<FloatingTabBar />)

    expect(screen.getByLabelText('Ledger').props.accessibilityState).toEqual({
      selected: true,
    })
    expect(screen.getByLabelText('Schedule').props.accessibilityState).toEqual({
      selected: false,
    })

    await fireEvent.press(screen.getByLabelText('Schedule'))
    expect(mockedReplace).toHaveBeenCalledWith('/')
  })
})
