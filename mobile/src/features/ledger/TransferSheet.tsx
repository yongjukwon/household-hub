import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { DateTimeField } from '@/components/DateTimeField'
import { SelectField } from '@/components/SelectField'
import { deviceTimeZone } from '@/features/household'
import { parseDollarsToCents } from '@/features/moneyInput'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'
import type { LedgerAsset, TransferFrequency } from './assets'
import { saveSchedule, saveTransfer } from './assetMutations'

function assetOptions(assets: LedgerAsset[], exclude?: string) {
  return assets.filter((a) => a.id !== exclude).map((a) => ({ value: a.id, label: a.name }))
}

/** One-off transfer between two assets. */
export function TransferSheet({
  open,
  onOpenChange,
  householdId,
  assets,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  assets: LedgerAsset[]
}) {
  const { tokens } = useTheme()
  const [from, setFrom] = useState(assets[0]?.id ?? '')
  const [to, setTo] = useState(assets[1]?.id ?? assets[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const cents = parseDollarsToCents(amount)
    if (!from || !to || from === to || !cents || cents <= 0) {
      setError('Pick two different assets and a positive amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveTransfer(
        householdId,
        {
          id: newUuid(),
          fromAssetId: from,
          toAssetId: to,
          amountCents: cents,
          occurredAt: new Date().toISOString(),
          note: note || null,
        },
        null,
      )
      setAmount('')
      setNote('')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="New transfer">
      <View style={styles.row}>
        <View style={styles.rowField}>
          <SelectField label="From" value={from} onChange={setFrom} options={assetOptions(assets, to)} />
        </View>
        <View style={styles.rowField}>
          <SelectField label="To" value={to} onChange={setTo} options={assetOptions(assets, from)} />
        </View>
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Amount</Text>
        <TextInput
          accessibilityLabel="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={tokens.muted3}
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Note (optional)</Text>
        <TextInput
          accessibilityLabel="Note"
          value={note}
          onChangeText={setNote}
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>
      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={() => void handleSave()}
        style={[
          styles.saveButton,
          { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl },
          saving && styles.disabled,
        ]}
      >
        <Text style={[styles.saveButtonText, { color: tokens.accentContrast }]}>Transfer</Text>
      </Pressable>
    </BottomSheet>
  )
}

const FREQUENCIES: { value: TransferFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semi_monthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Monthly' },
]

/** Create a recurring transfer schedule. */
export function ScheduleSheet({
  open,
  onOpenChange,
  householdId,
  assets,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  assets: LedgerAsset[]
}) {
  const { tokens } = useTheme()
  const [from, setFrom] = useState(assets[0]?.id ?? '')
  const [to, setTo] = useState(assets[1]?.id ?? assets[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<TransferFrequency>('monthly')
  const [startDate, setStartDate] = useState(new Date())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const cents = parseDollarsToCents(amount)
    if (!from || !to || from === to || !cents || cents <= 0) {
      setError('Pick two different assets and a positive amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const occursAt = new Date(startDate)
      occursAt.setHours(12, 0, 0, 0)
      await saveSchedule(
        householdId,
        {
          id: newUuid(),
          fromAssetId: from,
          toAssetId: to,
          amountCents: cents,
          frequency,
          startsAt: occursAt.toISOString(),
          timezone: deviceTimeZone(),
          active: true,
        },
        null,
      )
      setAmount('')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="New recurring transfer">
      <View style={styles.row}>
        <View style={styles.rowField}>
          <SelectField label="From" value={from} onChange={setFrom} options={assetOptions(assets, to)} />
        </View>
        <View style={styles.rowField}>
          <SelectField label="To" value={to} onChange={setTo} options={assetOptions(assets, from)} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.rowField}>
          <Text style={[styles.label, { color: tokens.muted }]}>Amount</Text>
          <TextInput
            accessibilityLabel="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={tokens.muted3}
            style={[
              styles.input,
              { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
            ]}
          />
        </View>
        <View style={styles.rowField}>
          <SelectField
            label="Frequency"
            value={frequency}
            onChange={(v) => setFrequency(v as TransferFrequency)}
            options={FREQUENCIES}
          />
        </View>
      </View>
      <View style={styles.field}>
        <DateTimeField label="Starts" value={startDate} mode="date" onChange={setStartDate} />
      </View>
      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={() => void handleSave()}
        style={[
          styles.saveButton,
          { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl },
          saving && styles.disabled,
        ]}
      >
        <Text style={[styles.saveButtonText, { color: tokens.accentContrast }]}>Schedule</Text>
      </Pressable>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  rowField: { flex: 1 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  error: { fontSize: 13, marginBottom: 10 },
  saveButton: { paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
})
