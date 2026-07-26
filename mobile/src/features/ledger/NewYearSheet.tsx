import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { operationOutcomeError } from '@/lib/operations'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'
import { createYear } from './statementMutations'
import type { LedgerYear } from './statements'

export function NewYearSheet({
  open,
  onOpenChange,
  householdId,
  years,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  years: LedgerYear[]
}) {
  const { tokens } = useTheme()
  const [value, setValue] = useState(String(new Date().getFullYear()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const year = Number(value)
    if (!/^\d{4}$/.test(value.trim()) || year < 1900 || year > 9999) {
      setError('Enter a four-digit year.')
      return
    }
    if (years.some((entry) => entry.year === year)) {
      setError(`${year} already exists.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await createYear(householdId, newUuid(), year)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="New statement year">
      <Text style={[styles.label, { color: tokens.muted }]}>Year</Text>
      <TextInput
        accessibilityLabel="Year"
        keyboardType="number-pad"
        maxLength={4}
        value={value}
        onChangeText={(text) => setValue(text.replace(/\D/g, '').slice(0, 4))}
        autoFocus
        style={[
          styles.input,
          { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
        ]}
      />
      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={() => void handleSave()}
        style={[
          styles.button,
          { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl },
          saving && styles.disabled,
        ]}
      >
        <Text style={[styles.buttonText, { color: tokens.accentContrast }]}>Create year</Text>
      </Pressable>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10 },
  error: { fontSize: 13, marginBottom: 10 },
  button: { paddingVertical: 13, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
})
