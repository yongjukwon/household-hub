import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SelectField } from '@/components/SelectField'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'
import { HOUSEHOLD_CURRENCY, type AssetKind, type LedgerAsset } from './assets'
import { deleteAsset, saveAsset } from './assetMutations'

const KINDS: { value: AssetKind; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
]

interface AssetSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  asset: LedgerAsset | null
  sortOrder: number
}

/** Create or edit an asset (name, kind, currency, current balance). */
export function AssetSheet({ open, onOpenChange, householdId, asset, sortOrder }: AssetSheetProps) {
  const { tokens } = useTheme()
  const [name, setName] = useState(asset?.name ?? '')
  const [kind, setKind] = useState<AssetKind>(asset?.kind ?? 'checking')
  const [currency, setCurrency] = useState(asset?.currencyCode ?? HOUSEHOLD_CURRENCY)
  const [balance, setBalance] = useState(centsToInputValue(asset?.balanceCents ?? 0))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const currencyLocked = !!asset

  async function handleSave() {
    if (name.trim().length === 0) return
    setSaving(true)
    try {
      await saveAsset(
        householdId,
        {
          id: asset?.id ?? newUuid(),
          name,
          kind,
          currency: currency.trim().toUpperCase() || HOUSEHOLD_CURRENCY,
          balanceCents: parseDollarsToCents(balance) ?? 0,
          sortOrder,
        },
        asset?.revision ?? null,
      )
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!asset) return
    setSaving(true)
    try {
      await deleteAsset(householdId, asset.id, asset.revision)
      setConfirmDelete(false)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={asset ? 'Edit asset' : 'New asset'}>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          autoFocus
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>
      <View style={styles.row}>
        <View style={styles.rowField}>
          <SelectField label="Type" value={kind} onChange={(v) => setKind(v as AssetKind)} options={KINDS} />
        </View>
        <View style={styles.rowField}>
          <Text style={[styles.label, { color: tokens.muted }]}>Currency</Text>
          <TextInput
            accessibilityLabel="Currency"
            value={currency}
            onChangeText={setCurrency}
            maxLength={3}
            autoCapitalize="characters"
            editable={!currencyLocked}
            style={[
              styles.input,
              {
                borderColor: tokens.line,
                borderRadius: tokens.radiusControl,
                color: tokens.ink,
                opacity: currencyLocked ? 0.6 : 1,
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Current balance</Text>
        <TextInput
          accessibilityLabel="Current balance"
          value={balance}
          onChangeText={setBalance}
          keyboardType="decimal-pad"
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>
      <View style={styles.actions}>
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
          <Text style={[styles.saveButtonText, { color: tokens.accentContrast }]}>Save</Text>
        </Pressable>
        {asset ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => setConfirmDelete(true)}
            style={[styles.deleteButton, saving && styles.disabled]}
          >
            <Text style={[styles.deleteButtonText, { color: tokens.danger }]}>Delete</Text>
          </Pressable>
        ) : null}
      </View>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete asset?"
        description="This removes the asset and its postings. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  rowField: { flex: 1 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  actions: { flexDirection: 'row', gap: 10 },
  saveButton: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  deleteButtonText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
