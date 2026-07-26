import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/theme/tokens'
import { BellIcon, CogIcon } from './icons'

/**
 * Persistent header shown on every primary destination, per the design
 * reference: the 🐰&🐧 wordmark top-left, bell (notifications) + gear
 * (settings) as floating circular white buttons top-right. No page title —
 * each screen renders its own large title inside its scroll content.
 */
export function AppHeader() {
  const { tokens } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.row,
        { paddingTop: insets.top + 6, backgroundColor: tokens.canvas },
      ]}
    >
      <Text style={[styles.mark, { color: tokens.ink }]}>🐰&🐧</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => router.push('/notifications')}
          style={[
            styles.iconButton,
            { backgroundColor: tokens.card },
            tokens.shadowCard,
          ]}
        >
          <BellIcon size={18} color={tokens.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={[
            styles.iconButton,
            { backgroundColor: tokens.card },
            tokens.shadowCard,
          ]}
        >
          <CogIcon size={18} color={tokens.muted} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  mark: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  actions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
