import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet, TextInput } from 'react-native'

import { AppHeader } from './AppHeader'
import { AppChromeProvider, useAppChrome } from './AppChrome'
import {
  backDestinationForPath,
  titleForPath,
} from './appHeaderTitle'

const mockedReplace = jest.fn()
let mockedPathname = '/ledger/year-id'

jest.mock('expo-router', () => ({
  usePathname: () => mockedPathname,
  useRouter: () => ({ push: jest.fn(), replace: mockedReplace }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

describe('AppHeader', () => {
  beforeEach(() => {
    mockedPathname = '/ledger/year-id'
    mockedReplace.mockReset()
  })

  it('names a Ledger year detail Budget', () => {
    expect(titleForPath('/ledger')).toBe('Ledger')
    expect(
      titleForPath('/ledger/11111111-1111-4111-8111-111111111111'),
    ).toBe('Budget')
  })

  it('centers the title independently of the right-side actions', async () => {
    const view = await render(<AppHeader />)
    const titleLayer = view.getByTestId('app-header-title-layer')

    expect(StyleSheet.flatten(titleLayer.props.style)).toMatchObject({
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
    })
  })

  it('maps each tab detail route to its owning destination', () => {
    expect(backDestinationForPath('/groceries/list-id')).toEqual({
      path: '/groceries',
      label: 'Back to Groceries',
    })
    expect(backDestinationForPath('/ledger/year-id')).toEqual({
      path: '/ledger',
      label: 'Back to Ledger',
    })
    expect(backDestinationForPath('/notes/note-id')).toEqual({
      path: '/notes',
      label: 'Back to Notes',
    })
    expect(backDestinationForPath('/trips/trip-id')).toEqual({
      path: '/trips',
      label: 'Back to Trips',
    })
    expect(backDestinationForPath('/groceries')).toBeNull()
  })

  it('returns to the owning tab from the shared header', async () => {
    const view = await render(<AppHeader />)

    await fireEvent.press(view.getByLabelText('Back to Ledger'))

    expect(mockedReplace).toHaveBeenCalledWith('/ledger')
  })

  it('does not show a back action on a root destination', async () => {
    mockedPathname = '/ledger'
    const view = await render(<AppHeader />)

    expect(view.queryByLabelText('Back to Ledger')).toBeNull()
  })

  it('gives Schedule its centered title, notification action, and 40px Add action', async () => {
    mockedPathname = '/'

    const view = await render(<AppHeader />)

    expect(view.getByRole('header', { name: 'Schedule' })).toBeTruthy()
    expect(view.getByLabelText('Notifications')).toBeTruthy()
    expect(StyleSheet.flatten(view.getByLabelText('Add').props.style)).toMatchObject({
      width: 40,
      height: 40,
    })
    expect(view.queryByLabelText('Settings')).toBeNull()
  })

  it('uses a route registration for the inline edit controls and centered title editor', async () => {
    mockedPathname = '/notes/note-id'
    const cancel = jest.fn()
    const save = jest.fn()

    function EditingRoute() {
      useAppChrome({
        mode: 'editing',
        title: <TextInput accessibilityLabel="Note title" value="Ideas" onChangeText={() => undefined} />,
        onCancel: cancel,
        onSave: save,
      })
      return null
    }

    const view = await render(
      <AppChromeProvider>
        <EditingRoute />
        <AppHeader />
      </AppChromeProvider>,
    )

    expect(view.getByLabelText('Note title')).toBeTruthy()
    await fireEvent.press(view.getByLabelText('Cancel'))
    await fireEvent.press(view.getByLabelText('Save'))
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledTimes(1)
  })
})
