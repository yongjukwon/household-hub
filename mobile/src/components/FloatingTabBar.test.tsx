import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { lightTokens } from '@/theme/tokens'
import { FloatingTabBar, TAB_BAR_FLOAT_OFFSET, TAB_BAR_HEIGHT } from './FloatingTabBar'

const mockedReplace = jest.fn()
let mockedPathname = '/ledger'

jest.mock('expo-router', () => ({
  usePathname: () => mockedPathname,
  useRouter: () => ({ replace: mockedReplace }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

describe('FloatingTabBar', () => {
  beforeEach(() => {
    mockedReplace.mockReset()
    mockedPathname = '/ledger'
  })

  it('floats above the bottom edge as a glass pill, not docked flush', async () => {
    const view = await render(<FloatingTabBar />)
    const root = view.toJSON()

    expect(root).not.toBeNull()
    // Two-layer surface: an outer plain View is absolutely positioned and
    // carries the floating shadow (unclipped), wrapping an inner BlurView
    // that carries the glass background/border and clips its own blur
    // content to the pill shape via overflow:'hidden'.
    expect(!Array.isArray(root) && root ? root.type : undefined).toBe('View')
    expect(
      StyleSheet.flatten(!Array.isArray(root) && root ? root.props.style : undefined),
    ).toMatchObject({
      position: 'absolute',
      bottom: TAB_BAR_FLOAT_OFFSET,
      height: TAB_BAR_HEIGHT,
      shadowColor: lightTokens.shadowFloat.shadowColor,
      shadowOpacity: lightTokens.shadowFloat.shadowOpacity,
      shadowRadius: lightTokens.shadowFloat.shadowRadius,
      elevation: lightTokens.shadowFloat.elevation,
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
      overflow: 'hidden',
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

  it('shows the saved three destinations and puts the omitted one in More', async () => {
    const view = await render(
      <FloatingTabBar navigation={['notes', 'trips', 'groceries']} />,
    )

    expect(view.queryByLabelText('Ledger')).toBeNull()
    await fireEvent.press(view.getByLabelText('More'))
    expect(view.getByLabelText('Open Ledger')).toBeTruthy()
    expect(view.getByLabelText('Open Settings')).toBeTruthy()
  })

  it('keeps More active while the omitted destination is open', async () => {
    mockedPathname = '/ledger/year-id'

    await render(<FloatingTabBar navigation={['notes', 'trips', 'groceries']} />)

    expect(screen.getByLabelText('More').props.accessibilityState).toEqual({
      selected: true,
      expanded: false,
    })
  })

  it('shows unread Schedule activity on the Schedule destination', async () => {
    const view = await render(<FloatingTabBar hasUnreadScheduleActivity />)

    expect(view.getByTestId('schedule-unread-indicator')).toBeTruthy()
  })
})
