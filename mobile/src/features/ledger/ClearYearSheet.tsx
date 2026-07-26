import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { useTheme } from '@/theme/tokens'
import { clearYear } from './statementMutations'
import type { LedgerYear } from './statements'

/**
 * Typed-year confirmation for clearing a Ledger year: the user must type the
 * year number exactly, matching the server's `confirmation` guard.
 */
export function ClearYearSheet({
  open,
  onOpenChange,
  householdId,
  year,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  year: LedgerYear
}) {
  const { tokens } = useTheme()
  const [typed, setTyped] = useState('')
  const [saving, setSaving] = useState(false)
  const matches = typed.trim() === String(year.year)

  async function handleClear() {
    if (!matches) return
    setSaving(true)
    try {
      await clearYear(householdId, year.id, year.year, year.revision)
      setTyped('')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={`Delete ${year.year}?`}>
      <Text style={[styles.description, { color: tokens.muted }]}>
        This permanently deletes the statement, all 12 monthly budgets, categories,
        limits, and transactions in{' '}
        <Text style={{ color: tokens.ink, fontWeight: '700' }}>{year.year}</Text>. Type{' '}
        <Text style={{ color: tokens.ink, fontWeight: '700' }}>{year.year}</Text> to confirm.
      </Text>
      <TextInput
        accessibilityLabel="Confirm year"
        value={typed}
        keyboardType="number-pad"
        placeholder={String(year.year)}
        placeholderTextColor={tokens.muted3}
        onChangeText={setTyped}
        style={[
          styles.input,
          { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!matches || saving}
        onPress={() => void handleClear()}
        style={[
          styles.button,
          { backgroundColor: tokens.danger, borderRadius: tokens.radiusControl },
          (!matches || saving) && styles.disabled,
        ]}
      >
        <Text style={styles.buttonText}>Delete {year.year}</Text>
      </Pressable>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  description: { fontSize: 13.5, lineHeight: 19, marginBottom: 12 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10 },
  button: { paddingVertical: 13, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
})
