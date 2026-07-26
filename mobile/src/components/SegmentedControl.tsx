import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}

/** Segmented control matching the web client's exactly: a muted pill track
 * with a raised active segment (white/dark surface + card shadow). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { tokens } = useTheme()

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[
        styles.track,
        { backgroundColor: tokens.cardAlt, borderRadius: tokens.radiusControl },
      ]}
    >
      {options.map((option) => {
        const active = value === option.value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              { borderRadius: tokens.radiusControl - 4 },
              active && [{ backgroundColor: tokens.card }, tokens.shadowCard],
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? tokens.ink : tokens.muted },
                active && styles.labelActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 4, padding: 4 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '500' },
  labelActive: { fontWeight: '600' },
})
