import type { ReactNode } from 'react'
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { BlurView } from 'expo-blur'

import { useTheme } from '@/theme/tokens'

interface CardProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  /**
   * `glass` (default): frosted, blurred surface for hero/section cards.
   * `row`: flatter, more opaque, unblurred surface for list rows.
   */
  variant?: 'glass' | 'row'
}

/** Surface card: glass or flat-row treatment, per the v2 design reference. */
export function Card({ children, style, variant = 'glass' }: CardProps) {
  const { tokens, scheme } = useTheme()

  if (variant === 'row') {
    return (
      <View
        style={[
          styles.surface,
          {
            backgroundColor: tokens.row.fill,
            borderColor: tokens.row.border,
            borderRadius: tokens.radiusCard,
          },
          style,
        ]}
      >
        {children}
      </View>
    )
  }

  return (
    <BlurView
      intensity={40}
      tint={scheme}
      style={[
        styles.surface,
        {
          backgroundColor: tokens.glass.fill,
          borderColor: tokens.glass.border,
          borderRadius: tokens.radiusCard,
        },
        tokens.shadowCard,
        style,
      ]}
    >
      {children}
    </BlurView>
  )
}

const styles = StyleSheet.create({
  surface: { padding: 16, borderWidth: 1 },
})
