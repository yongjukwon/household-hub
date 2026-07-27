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

  // Resolve the effective corner radius (a caller may override it via
  // `style`, e.g. a future variant like ListCard's radius override) so the
  // outer shadow-casting shape always matches the inner clipped surface.
  const resolvedRadius =
    StyleSheet.flatten([{ borderRadius: tokens.radiusCard }, style])
      .borderRadius ?? tokens.radiusCard

  return (
    // Two-layer split: BlurView does not reliably clip its own native blur
    // content to a borderRadius unless it also has overflow:'hidden' — but
    // overflow:'hidden' forces masksToBounds=true on iOS, which suppresses
    // the shadow below. So the shadow lives on this plain outer View
    // (no overflow:'hidden'), and the inner BlurView gets overflow:'hidden'
    // to clip the blur to the rounded shape.
    <View style={[{ borderRadius: resolvedRadius }, tokens.shadowCard]}>
      <BlurView
        intensity={40}
        tint={scheme}
        style={[
          styles.surface,
          {
            backgroundColor: tokens.glass.fill,
            borderColor: tokens.glass.border,
            borderRadius: tokens.radiusCard,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        {children}
      </BlurView>
    </View>
  )
}

const styles = StyleSheet.create({
  surface: { padding: 16, borderWidth: 1 },
})
