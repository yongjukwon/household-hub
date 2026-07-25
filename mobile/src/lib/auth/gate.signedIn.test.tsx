import { Stack } from 'expo-router'
import { renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Text } from 'react-native'

import { useAuthGate } from './gate'

// A signed-in user sitting on /login is sent to the default route (Calendar).
// One `renderRouter` per file — see the note in `gate.test.tsx`.
jest.mock('./AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, isReady: true }),
}))

describe('auth gate wiring (signed in)', () => {
  it('sends a signed-in user off login to the default route', async () => {
    renderRouter(
      {
        _layout: function Layout() {
          useAuthGate()
          return <Stack screenOptions={{ headerShown: false }} />
        },
        index: () => <Text>Calendar</Text>,
        login: () => <Text>Login</Text>,
      },
      { initialUrl: '/login' },
    )

    await waitFor(() => expect(screen.getByText('Calendar')).toBeOnTheScreen())
  })
})
