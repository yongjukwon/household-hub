import { Picker } from '@react-native-picker/picker'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'

export interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
}

/** Labeled native wheel-picker field — the RN equivalent of a web `<select>`. */
export function SelectField({ label, value, options, onChange, disabled }: SelectFieldProps) {
  const { tokens } = useTheme()

  return (
    <View>
      <Text style={[styles.label, { color: tokens.muted }]}>{label}</Text>
      <View
        style={[
          styles.wrap,
          { borderColor: tokens.line, borderRadius: tokens.radiusControl },
          disabled && styles.disabled,
        ]}
      >
        <Picker
          enabled={!disabled}
          selectedValue={value}
          onValueChange={(next) => onChange(String(next))}
          style={{ color: tokens.ink }}
        >
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  wrap: { borderWidth: 1, overflow: 'hidden' },
  disabled: { opacity: 0.6 },
})
