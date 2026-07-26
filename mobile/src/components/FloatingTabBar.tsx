import { useRouter, usePathname } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme, type ThemeTokens } from '@/theme/tokens'
import {
  CalendarIcon,
  GroceriesIcon,
  LedgerIcon,
  NotesIcon,
  TripsIcon,
  type IconProps,
} from './icons'

interface Destination {
  path: '/' | '/groceries' | '/ledger' | '/notes' | '/trips'
  label: string
  icon: (props: IconProps) => React.JSX.Element
}

const DESTINATIONS: Destination[] = [
  { path: '/', label: 'Schedule', icon: CalendarIcon },
  { path: '/groceries', label: 'Groceries', icon: GroceriesIcon },
  { path: '/ledger', label: 'Ledger', icon: LedgerIcon },
  { path: '/notes', label: 'Notes', icon: NotesIcon },
  { path: '/trips', label: 'Trips', icon: TripsIcon },
]

/**
 * Floating rounded pill bottom nav, per the design reference: white pill on
 * the canvas background, an active item gets a soft accent chip + bold accent
 * label, matching the web `MobileTabBar`'s `bg-accent-soft`/`text-accent`
 * treatment exactly.
 */
export function FloatingTabBar() {
  const { tokens } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: tokens.card,
          bottom: Math.max(22, insets.bottom + 10),
        },
        tokens.shadowFloat,
      ]}
    >
      {DESTINATIONS.map(({ path, label, icon: Icon }) => {
        const active = pathname === path
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
  pill: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    padding: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 999,
  },
})
