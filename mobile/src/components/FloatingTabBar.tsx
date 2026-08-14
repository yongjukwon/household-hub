import { useRouter, usePathname } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'

import { useTheme, type ThemeTokens } from '@/theme/tokens'
import { TAB_DESTINATIONS, tabActiveForPath } from './tabDestinations'
import {
  DEFAULT_MOBILE_NAVIGATION,
  omittedDestination,
  type MobileNavigation,
} from './mobileNavigation'
import { ChartBarIcon, CogIcon, EllipsisIcon } from './icons'

/** Distance the pill floats above the bottom safe-area edge. */
export const TAB_BAR_FLOAT_OFFSET = 20
/** Fixed height of the floating pill. */
export const TAB_BAR_HEIGHT = 66

/**
 * Floating pill tab bar per the v2 design reference: glass surface, 16px side
 * insets, 20px above the bottom safe area, with a real outline→filled icon
 * swap on the active tab (not just a stroke-width/color change).
 */
export function FloatingTabBar({
  navigation = DEFAULT_MOBILE_NAVIGATION,
  hasUnreadScheduleActivity = false,
}: {
  navigation?: MobileNavigation
  hasUnreadScheduleActivity?: boolean
}) {
  const { tokens, scheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const [moreOpen, setMoreOpen] = useState(false)
  const configured = navigation.map((key) => TAB_DESTINATIONS.find((item) => item.key === key)!)
  const omitted = TAB_DESTINATIONS.find(
    (item) => item.key === omittedDestination(navigation),
  )!
  const destinations = [TAB_DESTINATIONS[0], ...configured]
  const moreActive = tabActiveForPath(omitted.path, pathname)

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
        {destinations.map(({ path, label, icon: Icon, activeIcon: ActiveIcon }) => {
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
              {path === '/' && hasUnreadScheduleActivity ? (
                <View
                  testID="schedule-unread-indicator"
                  style={[styles.scheduleUnreadDot, { backgroundColor: tokens.danger }]}
                />
              ) : null}
              <Text style={itemLabelStyle(tokens, active)}>{label}</Text>
            </Pressable>
          )
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More"
          accessibilityState={{ selected: moreActive, expanded: moreOpen }}
          onPress={() => setMoreOpen(true)}
          style={styles.item}
        >
          <EllipsisIcon size={21} color={moreActive ? tokens.accent : tokens.muted} />
          <Text style={itemLabelStyle(tokens, moreActive)}>More</Text>
        </Pressable>
      </BlurView>
      <Modal transparent visible={moreOpen} animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMoreOpen(false)}>
          <View
            style={[
              styles.moreMenu,
              { bottom: insets.bottom + TAB_BAR_FLOAT_OFFSET + TAB_BAR_HEIGHT + 8, backgroundColor: tokens.card },
              tokens.shadowFloat,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${omitted.label}`}
              onPress={() => {
                setMoreOpen(false)
                router.replace(omitted.path)
              }}
              style={styles.menuRow}
            >
              <omitted.icon size={20} color={tokens.muted} />
              <Text style={[styles.menuText, { color: tokens.ink }]}>{omitted.label}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
              onPress={() => {
                setMoreOpen(false)
                router.push('/settings')
              }}
              style={styles.menuRow}
            >
              <CogIcon size={20} color={tokens.muted} />
              <Text style={[styles.menuText, { color: tokens.ink }]}>Settings</Text>
            </Pressable>
            {/*
              Pushed, not replaced: Purchase history is a leaf the user reads
              and then leaves, so it needs a back stack to return to whichever
              tab they came from. The rows above swap between top-level
              destinations, where replace is the right call.
            */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Purchase history"
              onPress={() => {
                setMoreOpen(false)
                router.push('/purchase-history')
              }}
              style={styles.menuRow}
            >
              <ChartBarIcon size={20} color={tokens.muted} />
              <Text style={[styles.menuText, { color: tokens.ink }]}>Purchase history</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
    position: 'relative',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: '100%',
  },
  scheduleUnreadDot: {
    position: 'absolute',
    top: 12,
    left: '57%',
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  backdrop: { flex: 1 },
  moreMenu: {
    position: 'absolute',
    right: 20,
    minWidth: 180,
    borderRadius: 16,
    paddingVertical: 6,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  menuText: { fontSize: 15, fontWeight: '600' },
})
