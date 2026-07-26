import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { DateTimeField } from '@/components/DateTimeField'
import { SelectField } from '@/components/SelectField'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import { operationOutcomeError } from '@/lib/operations'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'
import type { LedgerAsset } from './assets'
import type { CategoryKind, LedgerTransaction, MonthCategory } from './statements'
import { saveTransaction } from './statementMutations'

/** Add a transaction to a specific year/month. */
export function TransactionSheet({
  open,
  onOpenChange,
  householdId,
  yearId,
  month,
  kind,
  categories,
  assets,
  transaction = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  yearId: string
  month: number
  kind: CategoryKind
  categories: MonthCategory[]
  assets: LedgerAsset[]
  transaction?: LedgerTransaction | null
}) {
  const { tokens } = useTheme()
  const initialCategory = categories.find(
    (category) => category.kind === kind && category.categoryId === transaction?.categoryId,
  )
  const kindCategories = categories.filter((c) => c.kind === kind)
  const [categoryId, setCategoryId] = useState(initialCategory?.id ?? kindCategories[0]?.id ?? '')
  const [assetId, setAssetId] = useState(transaction?.assetId ?? assets[0]?.id ?? '')
  const [amount, setAmount] = useState(centsToInputValue(transaction?.amountCents))
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [date, setDate] = useState(
    transaction ? new Date(transaction.occurredAt) : new Date(),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const cents = parseDollarsToCents(amount)
    const category = kindCategories.find((c) => c.id === categoryId)
    if (!category || !assetId || !cents || cents <= 0 || description.trim().length === 0) {
      setError('Pick a category and asset, a positive amount, and a description.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const occurredAt = new Date(date)
      occurredAt.setHours(12, 0, 0, 0)
      const outcome = await saveTransaction(
        householdId,
        {
          id: transaction?.id ?? newUuid(),
          yearId,
          month,
          categoryId: category.categoryId,
          assetId,
          kind,
          amountCents: cents,
          occurredAt: occurredAt.toISOString(),
          description,
        },
        transaction?.revision ?? null,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      setAmount('')
      setDescription('')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={`${transaction ? 'Edit' : 'New'} ${kind}`}>
      <View style={styles.field}>
        <SelectField
          label="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={
            kindCategories.length === 0
              ? [{ value: '', label: 'No categories yet' }]
              : kindCategories.map((c) => ({ value: c.id, label: c.name }))
          }
        />
      </View>
      <View style={styles.row}>
        <View style={styles.rowField}>
          <SelectField
            label="Asset"
            value={assetId}
            onChange={setAssetId}
            options={assets.map((a) => ({ value: a.id, label: a.name }))}
          />
        </View>
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
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Description</Text>
        <TextInput
          accessibilityLabel="Description"
          value={description}
          onChangeText={setDescription}
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>
      <View style={styles.field}>
        <DateTimeField label="Date" value={date} mode="date" onChange={setDate} />
      </View>
      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving || assets.length === 0}
        onPress={() => void handleSave()}
        style={[
          styles.saveButton,
          { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl },
          (saving || assets.length === 0) && styles.disabled,
        ]}
      >
        <Text style={[styles.saveButtonText, { color: tokens.accentContrast }]}>Save</Text>
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
