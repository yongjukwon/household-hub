import { Stack } from 'expo-router'

import { PlaceholderScreen } from '@/components/PlaceholderScreen'

export default function NotificationsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Notifications' }} />
      <PlaceholderScreen
        title="Notifications"
        subtitle="Partner activity inbox arrives in Task 8."
      />
    </>
  )
}
