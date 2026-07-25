import { Tabs, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text } from 'react-native'

import { useTheme } from '@/theme/tokens'

/**
 * Five primary destinations, Calendar first and default (`index`). The
 * persistent header carries the identity mark plus the Notifications and
 * Settings actions; the reference visual system (Heroicons, floating bar) is
 * implemented in Task 8 — this is the navigational skeleton.
 */
export default function TabsLayout() {
  const { tokens } = useTheme()
  const router = useRouter()

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tokens.canvas },
        headerTitleStyle: { color: tokens.ink },
        headerTintColor: tokens.ink,
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.tabInactive,
        tabBarStyle: {
          backgroundColor: tokens.card,
          borderTopColor: tokens.border,
        },
        headerLeft: () => <Text style={styles.mark}>🐰🐧</Text>,
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            style={styles.headerAction}
          >
            <Text style={[styles.headerActionText, { color: tokens.ink }]}>
              ⚙
            </Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="groceries" options={{ title: 'Groceries' }} />
      <Tabs.Screen name="ledger" options={{ title: 'Ledger' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  mark: { fontSize: 18, marginLeft: 16 },
  headerAction: { paddingHorizontal: 16, paddingVertical: 4 },
  headerActionText: { fontSize: 20 },
})
