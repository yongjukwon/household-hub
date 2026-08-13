import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { useTheme } from '@/theme/tokens'
import type { GroceryItem } from './data'
import { parsePurchaseQuantity } from './data'
import { saveGroceryItem } from './mutations'

interface ItemSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  listId: string
  item: GroceryItem
  /** Position to keep when saving. */
  sortOrder: number
}

/** Edit an existing grocery item's name, quantity, and price (CAD). */
export function ItemSheet({
  open,
  onOpenChange,
  householdId,
  listId,
  item,
  sortOrder,
}: ItemSheetProps) {
  const { tokens } = useTheme()
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.purchaseQuantity?.toString() ?? '')
  const [price, setPrice] = useState(centsToInputValue(item.totalPriceCents))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (name.trim().length === 0) return
    const purchaseQuantity = parsePurchaseQuantity(quantity)
    const totalPriceCents = parseDollarsToCents(price)
    if (purchaseQuantity === null) {
      setError('Quantity must be a positive number.')
      return
    }
    if (price.trim() && (totalPriceCents === null || totalPriceCents <= 0)) {
      setError('Price must be greater than zero.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await saveGroceryItem(
        householdId,
        {
          id: item.id,
          listId,
          name,
          quantity: String(purchaseQuantity),
          checked: item.checked,
          unitPriceCents: totalPriceCents === null ? null : Math.round(totalPriceCents / purchaseQuantity),
          purchaseQuantity,
          totalPriceCents,
          purchaseOccurrenceId: item.purchaseOccurrenceId,
          sortOrder,
        },
        item.revision,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      onOpenChange(false)
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not save this item.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Edit item">
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>
      <View style={styles.row}>
        <View style={styles.rowField}>
          <Text style={[styles.label, { color: tokens.muted }]}>Quantity</Text>
          <TextInput
            accessibilityLabel="Quantity"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g. 2"
            placeholderTextColor={tokens.muted3}
            style={[
              styles.input,
              { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
            ]}
          />
        </View>
        <View style={styles.rowField}>
          <Text style={[styles.label, { color: tokens.muted }]}>Price (CAD)</Text>
          <TextInput
            accessibilityLabel="Price"
            value={price}
            onChangeText={setPrice}
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
  saveButton: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  error: { fontSize: 13, marginBottom: 10 },
  disabled: { opacity: 0.6 },
})
