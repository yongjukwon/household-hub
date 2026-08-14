import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { parseDollarsToCents } from '@/features/moneyInput'
import { useTheme } from '@/theme/tokens'
import { parsePurchaseQuantity, type GroceryItem } from './data'

export function PurchasePrompt({
  item,
  onCancel,
  onSavePrice,
  onCheckWithoutPrice,
  saving = false,
  submissionError = null,
}: {
  item: GroceryItem
  onCancel: () => void
  onSavePrice: (quantity: number, totalPriceCents: number) => void
  onCheckWithoutPrice: () => void
  saving?: boolean
  submissionError?: string | null
}) {
  const { tokens } = useTheme()
  const [quantity, setQuantity] = useState(item.purchaseQuantity?.toString() ?? '1')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  function save() {
    const parsedQuantity = parsePurchaseQuantity(quantity)
    const total = parseDollarsToCents(price)
    if (parsedQuantity === null) return setError('Quantity must be a positive number.')
    if (total === null || total <= 0) return setError('Price must be greater than zero.')
    setError(null)
    onSavePrice(parsedQuantity, total)
  }

  return (
    <BottomSheet open onOpenChange={(open) => { if (!open) onCancel() }} title={`Purchase ${item.name}`}>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: tokens.muted }]}>Quantity</Text>
          <TextInput accessibilityLabel="Purchase quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={[styles.input, { color: tokens.ink, borderColor: tokens.line }]} />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: tokens.muted }]}>Price (CAD)</Text>
          <TextInput accessibilityLabel="Purchase price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={[styles.input, { color: tokens.ink, borderColor: tokens.line }]} />
        </View>
      </View>
      {error ?? submissionError ? (
        <Text style={[styles.error, { color: tokens.danger }]}>{error ?? submissionError}</Text>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={save} style={[styles.primary, { backgroundColor: tokens.accent }, saving && styles.disabled]}>
        <Text style={[styles.primaryText, { color: tokens.accentContrast }]}>Save price and check</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={onCheckWithoutPrice} style={[styles.secondary, saving && styles.disabled]}>
        <Text style={[styles.secondaryText, { color: tokens.muted }]}>Check without price</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={onCancel} style={[styles.secondary, saving && styles.disabled]}>
        <Text style={[styles.secondaryText, { color: tokens.muted }]}>Cancel</Text>
      </Pressable>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  error: { fontSize: 13, marginTop: 10 },
  primary: { marginTop: 16, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  primaryText: { fontWeight: '700' },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
