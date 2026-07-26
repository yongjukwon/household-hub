import { Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { PlusIcon } from '@/components/icons'
import { TAB_BAR_FLOAT_OFFSET, TAB_BAR_HEIGHT } from '@/components/FloatingTabBar'
import { useTheme } from '@/theme/tokens'

interface FloatingActionButtonProps {
  accessibilityLabel: string
  onPress: () => void
  disabled?: boolean
}

const BOTTOM_OFFSET = TAB_BAR_FLOAT_OFFSET + TAB_BAR_HEIGHT + 12

/** Shared root-screen create action, positioned above the floating tab bar. */
export function FloatingActionButton({
  accessibilityLabel,
  onPress,
  disabled = false,
}: FloatingActionButtonProps) {
  const { tokens } = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <LinearGradient
        colors={tokens.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, tokens.shadowFloat]}
      >
        <PlusIcon size={24} strokeWidth={2} color={tokens.accentContrast} />
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    bottom: BOTTOM_OFFSET,
    zIndex: 20,
    width: 54,
    height: 54,
  },
  fill: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
})
