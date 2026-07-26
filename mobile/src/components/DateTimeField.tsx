import DateTimePicker from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'

interface DateTimeFieldProps {
  label: string
  value: Date
  mode: 'date' | 'datetime'
  minimumDate?: Date
  onChange: (date: Date) => void
}

/**
 * A labeled field that opens the platform's native date/time picker. iOS
 * renders the picker inline once opened (compact spinner popover); Android's
 * picker is an imperative dialog, so the component unmounts itself once a
 * value is picked or the dialog is dismissed — the standard cross-platform
 * pattern for `@react-native-community/datetimepicker`.
 */
export function DateTimeField({
  label,
  value,
  mode,
  minimumDate,
  onChange,
}: DateTimeFieldProps) {
  const { tokens } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <View>
      <Text style={[styles.label, { color: tokens.muted }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          { borderColor: tokens.line, borderRadius: tokens.radiusControl },
        ]}
      >
        <Text style={[styles.value, { color: tokens.ink }]}>
          {formatValue(value, mode)}
        </Text>
      </Pressable>

      {open && (Platform.OS === 'ios' || Platform.OS === 'android') ? (
        <DateTimePicker
          value={value}
          mode={mode}
          minimumDate={minimumDate}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS === 'android') setOpen(false)
            if (event.type === 'dismissed') return
            if (date) onChange(date)
          }}
        />
      ) : null}
    </View>
  )
}

function formatValue(value: Date, mode: 'date' | 'datetime'): string {
  if (mode === 'date') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(value)
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  field: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  value: { fontSize: 15 },
})
