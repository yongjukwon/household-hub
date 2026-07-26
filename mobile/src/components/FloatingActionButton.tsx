import { Pressable, StyleSheet } from 'react-native'

import { PlusIcon } from '@/components/icons'
import { useTheme } from '@/theme/tokens'

interface FloatingActionButtonProps {
  accessibilityLabel: string
  onPress: () => void
  disabled?: boolean
}

/** Shared root-screen create action, positioned above the docked tab bar. */
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
      style={[
        styles.button,
        {
          backgroundColor: tokens.accent,
          borderColor: tokens.card,
        },
        tokens.shadowFloat,
        disabled && styles.disabled,
      ]}
    >
      <PlusIcon size={24} strokeWidth={2} color={tokens.accentContrast} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    zIndex: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
})
