import { usePathname, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/theme/tokens'
import {
  backDestinationForPath,
  titleForPath,
} from './appHeaderTitle'
import { BellIcon, ChevronLeftIcon, CogIcon } from './icons'

/**
 * Persistent header shown on every primary destination: the current page's
 * title top-left (matching the active tab), bell (notifications) + gear
 * (settings) as floating circular buttons top-right.
 */
export function AppHeader() {
  const { tokens } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const backDestination = backDestinationForPath(pathname)

  return (
    <View
      style={[
        styles.row,
        { paddingTop: insets.top + 6, backgroundColor: tokens.canvas },
      ]}
    >
      <View
        testID="app-header-title-layer"
        pointerEvents="none"
        style={styles.titleLayer}
      >
        <Text accessibilityRole="header" style={[styles.title, { color: tokens.ink }]}>
          {titleForPath(pathname)}
        </Text>
      </View>
      {backDestination ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backDestination.label}
          hitSlop={4}
          onPress={() => router.replace(backDestination.path)}
          style={[
            styles.iconButton,
            { backgroundColor: tokens.card },
            tokens.shadowCard,
          ]}
        >
          <ChevronLeftIcon size={18} color={tokens.muted} />
        </Pressable>
      ) : (
        <View style={styles.leftSpacer} />
      )}
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
    position: 'relative',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  titleLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2 },
  leftSpacer: { width: 36, height: 36 },
  actions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
