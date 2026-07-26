import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import { useTheme } from '@/theme/tokens'
import type { GroceryItem } from './data'
import { deleteGroceryItem, saveGroceryItem } from './mutations'

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
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [price, setPrice] = useState(centsToInputValue(item.unitPriceCents))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    if (name.trim().length === 0) return
    setSaving(true)
    try {
      await saveGroceryItem(
        householdId,
        {
          id: item.id,
          listId,
          name,
          quantity: quantity || null,
          checked: item.checked,
          unitPriceCents: parseDollarsToCents(price),
          sortOrder,
        },
        item.revision,
      )
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteGroceryItem(householdId, item.id, item.revision)
      setConfirmDelete(false)
      onOpenChange(false)
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
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => setConfirmDelete(true)}
          style={[styles.deleteButton, saving && styles.disabled]}
        >
          <Text style={[styles.deleteButtonText, { color: tokens.danger }]}>Delete</Text>
        </Pressable>
      </View>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete item?"
        description="This removes the item from the list."
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
  actions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  saveButton: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  deleteButtonText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
