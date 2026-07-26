import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DateTimeField } from '@/components/DateTimeField'
import { SelectField } from '@/components/SelectField'
import { HOUSEHOLD_CURRENCY, type LedgerAsset } from '@/features/ledger/assets'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import { newUuid } from '@/lib/uuid'
import { operationOutcomeError } from '@/lib/operations'
import { useTheme } from '@/theme/tokens'
import type {
  BookingEntry,
  ItineraryEntry,
  Trip,
  TripExpense,
} from './data'
import {
  compatibleExpenseAssets,
  expenseLinkValue,
  parseExpenseLink,
} from './forms'
import { deleteExpense, saveExpense } from './mutations'

function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface ExpenseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  trip: Trip
  assets: LedgerAsset[]
  expense: TripExpense | null
  itinerary: ItineraryEntry[]
  bookings: BookingEntry[]
}

/**
 * Add/edit a trip expense. Currency defaults to the trip's destination
 * currency but can be the household currency (CAD) for at-home spending; the
 * server links a CAD expense into the Ledger and debits the chosen asset.
 */
export function ExpenseSheet({
  open,
  onOpenChange,
  householdId,
  trip,
  assets,
  expense,
  itinerary,
  bookings,
}: ExpenseSheetProps) {
  const { tokens } = useTheme()
  const router = useRouter()
  const currencyChoices = Array.from(new Set([trip.destinationCurrency.toUpperCase(), HOUSEHOLD_CURRENCY]))
  const initialCurrency = expense?.currencyCode.toUpperCase() ?? trip.destinationCurrency.toUpperCase()
  const initialAssets = compatibleExpenseAssets(assets, initialCurrency)
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(centsToInputValue(expense?.amountCents ?? null))
  const [currency, setCurrency] = useState(initialCurrency)
  const [assetId, setAssetId] = useState(
    initialAssets.some((asset) => asset.id === expense?.assetId)
      ? expense!.assetId
      : initialAssets[0]?.id ?? '',
  )
  const [date, setDate] = useState(
    new Date(`${(expense?.spentAt ?? trip.startDate + 'T12:00:00Z').slice(0, 10)}T00:00:00`),
  )
  const [link, setLink] = useState(
    expenseLinkValue({
      itineraryEntryId: expense?.itineraryEntryId ?? null,
      bookingEntryId: expense?.bookingEntryId ?? null,
    }),
  )
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const compatibleAssets = compatibleExpenseAssets(assets, currency)

  async function handleSave() {
    const cents = parseDollarsToCents(amount)
    if (!compatibleAssets.some((asset) => asset.id === assetId) || !cents || cents <= 0 || description.trim().length === 0) {
      setError('Pick an asset, a positive amount, and a description.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const linkIds = parseExpenseLink(link)
      const outcome = await saveExpense(
        householdId,
        {
          id: expense?.id ?? newUuid(),
          tripId: trip.id,
          assetId,
          amountCents: cents,
          currency,
          spentAt: new Date(`${dateKey(date)}T12:00:00Z`).toISOString(),
          description,
          ...linkIds,
        },
        expense?.revision ?? null,
      )
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

  async function handleDelete() {
    if (!expense) return
    setSaving(true)
    try {
      const outcome = await deleteExpense(householdId, expense.id, expense.revision)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        setConfirmDelete(false)
        return
      }
      setConfirmDelete(false)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={expense ? 'Edit expense' : 'New expense'}>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Description</Text>
        <TextInput
          accessibilityLabel="Description"
          value={description}
          onChangeText={setDescription}
          autoFocus
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
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
            label="Currency"
            value={currency}
            onChange={(next) => {
              setCurrency(next)
              setAssetId(compatibleExpenseAssets(assets, next)[0]?.id ?? '')
            }}
            options={currencyChoices.map((c) => ({ value: c, label: c }))}
          />
        </View>
      </View>
      <View style={styles.field}>
        <SelectField
          label="Paid from"
          value={assetId}
          onChange={setAssetId}
          disabled={compatibleAssets.length === 0}
          options={
            compatibleAssets.length === 0
              ? [{ value: '', label: 'No matching assets' }]
              : compatibleAssets.map((a) => ({ value: a.id, label: a.name }))
          }
        />
        {compatibleAssets.length === 0 ? (
          <Pressable
            onPress={() => router.push({ pathname: '/ledger', params: { segment: 'assets' } })}
            style={styles.assetLinkRow}
          >
            <Text style={[styles.assetLinkText, { color: tokens.muted }]}>
              No {currency} Asset is available.{' '}
              <Text style={{ color: tokens.accent, fontWeight: '700' }}>Add a {currency} Asset</Text>
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.field}>
        <DateTimeField label="Date" value={date} mode="date" onChange={setDate} />
      </View>
      <View style={styles.field}>
        <SelectField
          label="Linked activity (optional)"
          value={link}
          onChange={setLink}
          options={[
            { value: 'standalone', label: 'Standalone expense' },
            ...itinerary.map((entry) => ({
              value: `itinerary:${entry.id}`,
              label: `Itinerary · ${entry.title}`,
            })),
            ...bookings.map((entry) => ({
              value: `booking:${entry.id}`,
              label: `Booking · ${entry.title}`,
            })),
          ]}
        />
      </View>
      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={saving || compatibleAssets.length === 0}
          onPress={() => void handleSave()}
          style={[
            styles.saveButton,
            { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl },
            (saving || compatibleAssets.length === 0) && styles.disabled,
          ]}
        >
          <Text style={[styles.saveButtonText, { color: tokens.accentContrast }]}>Save</Text>
        </Pressable>
        {expense ? (
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
        title="Delete expense?"
        description="This removes the expense and reverses its asset debit."
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
  assetLinkRow: { marginTop: 8 },
  assetLinkText: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 13, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  saveButton: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  deleteButtonText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
