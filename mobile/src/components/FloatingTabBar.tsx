import { useRouter, usePathname } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme, type ThemeTokens } from '@/theme/tokens'
import { TAB_DESTINATIONS, tabActiveForPath } from './tabDestinations'

/**
 * Bottom tab bar, docked flush with the bottom safe area (not floating) so
 * screens recover the vertical space a hovering pill used to cost them.
 */
export function FloatingTabBar() {
  const { tokens } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: tokens.card, paddingBottom: insets.bottom + 6 },
        tokens.shadowFloat,
      ]}
    >
      {TAB_DESTINATIONS.map(({ path, label, icon: Icon }) => {
        const active = tabActiveForPath(path, pathname)
        return (
          <Pressable
            key={path}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => router.replace(path)}
            style={[
              styles.item,
              active && { backgroundColor: tokens.accentSoft },
            ]}
          >
            <Icon
              size={20}
              color={active ? tokens.accent : tokens.muted}
              strokeWidth={active ? 2 : 1.5}
            />
            <Text style={itemLabelStyle(tokens, active)}>{label}</Text>
          </Pressable>
        )
      })}
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
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 12,
  },
})
