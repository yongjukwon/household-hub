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
              <StatusBar style="auto" />
              <RootNavigator />
            </HouseholdRuntime>
          </AuthProvider>
        </AppearanceProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  )
}
