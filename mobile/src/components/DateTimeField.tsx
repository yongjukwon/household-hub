import DateTimePicker from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'

interface DateTimeFieldProps {
  label: string
  value: Date
  mode: 'date' | 'time' | 'datetime'
  minimumDate?: Date
  maximumDate?: Date
  /** Override the iOS display style. Defaults to 'inline' for dates, 'spinner' for times. */
  iosDisplay?: 'inline' | 'spinner' | 'compact'
  onChange: (date: Date) => void
}

/**
 * iOS: renders the picker inline — a calendar for dates, a scroll wheel for
 * times. Callers can override via `iosDisplay`.
 * Android: tap-to-open dialog (the platform's only option).
 */
export function DateTimeField({
  label,
  value,
  mode,
  minimumDate,
  maximumDate,
  iosDisplay,
  onChange,
}: DateTimeFieldProps) {
  const { tokens } = useTheme()
  const [open, setOpen] = useState(false)

  const resolvedIosDisplay = iosDisplay ?? (mode === 'time' ? 'spinner' : 'inline')

  if (Platform.OS === 'ios') {
    return (
      <View>
        {label ? <Text style={[styles.label, { color: tokens.muted }]}>{label}</Text> : null}
        <DateTimePicker
          value={value}
          mode={mode}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          display={resolvedIosDisplay}
          onChange={(_event, date) => {
            if (date) onChange(date)
          }}
          style={resolvedIosDisplay === 'spinner' ? styles.spinner : undefined}
        />
      </View>
    )
  }

  return (
    <View>
      {label ? <Text style={[styles.label, { color: tokens.muted }]}>{label}</Text> : null}
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

      {open ? (
        <DateTimePicker
          value={value}
          mode={mode === 'datetime' ? 'date' : mode}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          display={mode === 'time' ? 'clock' : 'calendar'}
          onChange={(event, date) => {
            setOpen(false)
            if (event.type === 'dismissed') return
            if (date) onChange(date)
          }}
        />
      ) : null}
    </View>
  )
}

function formatValue(value: Date, mode: 'date' | 'time' | 'datetime'): string {
  if (mode === 'date') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(value)
  }
  if (mode === 'time') {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
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
  spinner: { height: 150 },
})
