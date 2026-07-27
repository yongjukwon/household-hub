import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider } from '@/lib/auth/AuthContext'
import { useAuthGate, useSupabaseAutoRefresh } from '@/lib/auth/gate'
import { useOAuthDeepLinks } from '@/lib/auth/useOAuthDeepLinks'
import { HouseholdRuntime } from '@/lib/HouseholdRuntime'
import { useOperationSync } from '@/lib/operations/useOperationSync'
import { createQueryClient } from '@/lib/query'
import {
  MOBILE_QUERY_CACHE_BUSTER,
  createQueryPersister,
} from '@/lib/queryPersister'
import { useQueryEnvironment } from '@/lib/useQueryEnvironment'
import { AppearanceProvider } from '@/theme/AppearanceProvider'
import { useTheme } from '@/theme/tokens'

/**
 * `expo-status-bar`'s `style="auto"` follows the OS `useColorScheme()`, not
 * this app's own Light/Dark/System override (`useAppearance`/`useTheme`) — so
 * picking "Dark" in-app while the phone is set to System/Light (or vice
 * versa) left the status bar icons matching the OS scheme instead of the
 * app's, rendering illegibly against the resolved background.
 */
function ThemedStatusBar() {
  const { scheme } = useTheme()
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
}

function RootNavigator() {
  useQueryEnvironment()
  useSupabaseAutoRefresh()
  useOAuthDeepLinks()
  useOperationSync()
  useAuthGate()

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="settings" options={{ presentation: 'card' }} />
      <Stack.Screen
        name="notifications"
        options={{ presentation: 'card' }}
      />
    </Stack>
  )
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient)
  const [persister] = useState(createQueryPersister)

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          buster: MOBILE_QUERY_CACHE_BUSTER,
          maxAge: Number.POSITIVE_INFINITY,
          persister,
        }}
      >
        <AppearanceProvider>
          <AuthProvider>
            <HouseholdRuntime>
              <ThemedStatusBar />
              <RootNavigator />
            </HouseholdRuntime>
          </AuthProvider>
        </AppearanceProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  )
}
