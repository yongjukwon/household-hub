import { Slot } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProfile } from '@/features/settings/profile'

import { AppHeader } from '@/components/AppHeader'
import { AppChromeProvider } from '@/components/AppChrome'
import { GradientBackground } from '@/components/GradientBackground'
import {
  FloatingTabBar,
  TAB_BAR_FLOAT_OFFSET,
  TAB_BAR_HEIGHT,
} from '@/components/FloatingTabBar'

/**
 * Five primary destinations, Calendar first and default (`index`). Renders
 * the persistent header and floating tab bar as chrome around whichever route
 * is active — a custom layout (not expo-router's built-in `<Tabs>` bar)
 * because the design reference's floating pill and title-less header don't
 * map onto the native tab bar's header/label conventions.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const profile = useProfile()

  return (
    <View style={styles.root}>
      <GradientBackground />
      <AppChromeProvider>
        <AppHeader />
        <View
          style={[
            styles.content,
            { paddingBottom: insets.bottom + TAB_BAR_FLOAT_OFFSET + TAB_BAR_HEIGHT + 12 },
          ]}
        >
          <Slot />
        </View>
        <FloatingTabBar navigation={profile.data?.mobileNavigation} />
      </AppChromeProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
})
