import { Slot } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { AppHeader } from '@/components/AppHeader'
import { FloatingTabBar } from '@/components/FloatingTabBar'
import { useTheme } from '@/theme/tokens'

/**
 * Five primary destinations, Calendar first and default (`index`). Renders
 * the persistent header and floating tab bar as chrome around whichever route
 * is active — a custom layout (not expo-router's built-in `<Tabs>` bar)
 * because the design reference's floating pill and title-less header don't
 * map onto the native tab bar's header/label conventions.
 */
export default function TabsLayout() {
  const { tokens } = useTheme()

  return (
    <View style={[styles.root, { backgroundColor: tokens.canvas }]}>
      <AppHeader />
      <View style={styles.content}>
        <Slot />
      </View>
      <FloatingTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
})
