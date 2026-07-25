import { Stack } from 'expo-router'
import { renderRouter, screen, waitFor } from 'expo-router/testing-library'
import { Text } from 'react-native'

import { useAuthGate } from './gate'

// Control the session without a real Supabase client.
jest.mock('./AuthContext', () => ({
  useAuth: () => ({ session: null, isReady: true }),
}))

// The decision matrix is unit-tested exhaustively in `redirect.test.ts`. This
// file proves the end-to-end wiring: AuthContext → useAuthGate →
// resolveAuthRedirect → router.replace → real navigation. expo-router's test
// harness only supports one `renderRouter` per module (its global store is not
// reset between calls), so each wiring scenario lives in its own file.
describe('auth gate wiring', () => {
  it('redirects a signed-out user from a protected route to login', async () => {
    renderRouter(
      {
        _layout: function Layout() {
          useAuthGate()
          return <Stack screenOptions={{ headerShown: false }} />
        },
        index: () => <Text>Calendar</Text>,
        login: () => <Text>Login</Text>,
      },
      { initialUrl: '/' },
    )

    await waitFor(() => expect(screen.getByText('Login')).toBeOnTheScreen())
  })
})
