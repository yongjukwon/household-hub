import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useRef } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider } from '@/lib/auth/AuthContext'
import { useAuthGate, useSupabaseAutoRefresh } from '@/lib/auth/gate'
import { useOAuthDeepLinks } from '@/lib/auth/useOAuthDeepLinks'
import { useOperationSync } from '@/lib/operations/useOperationSync'
import { createQueryClient } from '@/lib/query'
import { AppearanceProvider } from '@/theme/AppearanceProvider'

function RootNavigator() {
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
  const queryClient = useRef(createQueryClient()).current

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppearanceProvider>
          <AuthProvider>
            <StatusBar style="auto" />
            <RootNavigator />
          </AuthProvider>
        </AppearanceProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
