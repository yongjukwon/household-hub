import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { useTheme } from '@/theme/tokens'

/** Surface card: white/dark, rounded, soft-shadowed, per the design reference. */
export function Card({
  children,
  style,
}: {
  children?: ReactNode
  style?: ViewStyle | ViewStyle[]
}) {
  const { tokens } = useTheme()

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.card,
          borderRadius: tokens.radiusCard,
        },
        tokens.shadowCard,
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16 },
})
