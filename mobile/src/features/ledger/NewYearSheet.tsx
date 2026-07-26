import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

import { BottomSheet } from '@/components/BottomSheet'
import { SelectField } from '@/components/SelectField'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'
import { createYear } from './statementMutations'
import { seedPendingLedgerYear, type LedgerYear } from './statements'

function candidateYears(existing: number[]): number[] {
  const current = new Date().getFullYear()
  const range = Array.from({ length: 13 }, (_, i) => current + 2 - i)
  return Array.from(new Set([...range, ...existing])).sort((a, b) => b - a)
}

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
  const queryClient = useQueryClient()
  const existingYears = useMemo(() => years.map((entry) => entry.year), [years])
  const options = useMemo(
    () =>
      candidateYears(existingYears).map((year) => ({
        value: String(year),
        label: existingYears.includes(year) ? `${year} (already created)` : String(year),
        disabled: existingYears.includes(year),
      })),
    [existingYears],
  )
  const [value, setValue] = useState(
    () => options.find((option) => !option.disabled)?.value ?? options[0]?.value ?? '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const year = Number(value)
    if (!/^\d{4}$/.test(value) || year < 1900 || year > 9999) {
      setError('Enter a four-digit year.')
      return
    }
    if (existingYears.includes(year)) {
      setError(`${year} already exists.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const yearId = newUuid()
      const outcome = await createYear(householdId, yearId, year)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      if (outcome.status === 'queued') {
        seedPendingLedgerYear(queryClient, householdId, yearId, year)
      }
      onOpenChange(false)
    } catch (failure) {
      setError(
        operationThrownError(failure, 'Could not create this statement year.'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="New statement year">
      <SelectField label="Year" value={value} options={options} onChange={setValue} />
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
  error: { fontSize: 13, marginTop: 8, marginBottom: 10 },
  button: { paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
})
