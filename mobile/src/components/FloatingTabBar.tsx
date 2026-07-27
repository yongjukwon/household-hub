import { useRouter, usePathname } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'

import { useTheme, type ThemeTokens } from '@/theme/tokens'
import { TAB_DESTINATIONS, tabActiveForPath } from './tabDestinations'

/** Distance the pill floats above the bottom safe-area edge. */
export const TAB_BAR_FLOAT_OFFSET = 20
/** Fixed height of the floating pill. */
export const TAB_BAR_HEIGHT = 66

/**
 * Floating pill tab bar per the v2 design reference: glass surface, 16px side
 * insets, 20px above the bottom safe area, with a real outline→filled icon
 * swap on the active tab (not just a stroke-width/color change).
 */
export function FloatingTabBar() {
  const { tokens, scheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  return (
    // Two-layer split (see Card.tsx for the same pattern/reasoning): the
    // outer plain View is absolutely positioned exactly as this bar always
    // was and carries the floating shadow (no overflow:'hidden', so the
    // shadow isn't clipped away). The inner BlurView carries the glass
    // background/border and overflow:'hidden' so the blur content is
    // clipped to the pill shape instead of leaking past its rounded corners.
    <View
      style={[
        styles.bar,
        { bottom: insets.bottom + TAB_BAR_FLOAT_OFFSET },
        tokens.shadowFloat,
      ]}
    >
      <BlurView
        intensity={60}
        tint={scheme}
        style={[
          styles.barInner,
          {
            backgroundColor: tokens.glass.fill,
            borderColor: tokens.glass.border,
          },
        ]}
      >
        {TAB_DESTINATIONS.map(({ path, label, icon: Icon, activeIcon: ActiveIcon }) => {
          const active = tabActiveForPath(path, pathname)
          const TabIcon = active ? ActiveIcon : Icon
          return (
            <Pressable
              key={path}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => router.replace(path)}
              style={styles.item}
            >
              <TabIcon size={21} color={active ? tokens.accent : tokens.muted} />
              <Text style={itemLabelStyle(tokens, active)}>{label}</Text>
            </Pressable>
          )
        })}
      </BlurView>
    </View>
  )
}

function itemLabelStyle(tokens: ThemeTokens, active: boolean) {
  return {
    fontSize: 10,
    fontWeight: active ? ('700' as const) : ('500' as const),
    color: active ? tokens.accent : tokens.muted,
  }
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: TAB_BAR_HEIGHT,
    borderRadius: 26,
  },
  barInner: {
    flex: 1,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: '100%',
  },
})
