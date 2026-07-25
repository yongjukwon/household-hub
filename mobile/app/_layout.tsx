import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useRef } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider } from '@/lib/auth/AuthContext'
import { useAuthGate, useSupabaseAutoRefresh } from '@/lib/auth/gate'
import { createQueryClient } from '@/lib/query'

function RootNavigator() {
  useSupabaseAutoRefresh()
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
        <AuthProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
