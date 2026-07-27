// Global Jest setup for the Expo app.
//
// jest-expo provides most of the React Native + Expo module mocks. This file
// adds the community/native modules the offline data layer depends on so unit
// tests never touch a real device bridge.

// @testing-library/react-native v14 extends Jest's expect with its native
// matchers automatically on import — no separate extend-expect entry needed.

// Dummy public env so `createClient` (which validates the URL) can construct at
// import time. Tests that exercise the network mock `supabase.rpc`/`auth`.
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'

// AsyncStorage ships an official in-memory Jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// NetInfo: default to an online, reachable connection. Individual tests can
// override the listener behaviour as needed.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true }),
    ),
  },
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true }),
  ),
}))

// expo-blur ships a native view; tests just need something renderable.
jest.mock('expo-blur', () => {
  // In tests, render BlurView as a named component type so root.type is 'BlurView'.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BlurView = (props: any) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement('BlurView' as any, props, props.children)

  return { BlurView }
})

// expo-linear-gradient ships a native view; tests just need something renderable.
jest.mock('expo-linear-gradient', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { LinearGradient: View }
})
