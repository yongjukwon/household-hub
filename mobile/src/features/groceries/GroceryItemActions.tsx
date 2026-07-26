import { Pressable, StyleSheet, View } from 'react-native'

import { PencilIcon, TrashIcon } from '@/components/icons'
import { useTheme } from '@/theme/tokens'

export function GroceryItemActions({
  itemName,
  onEdit,
  onDelete,
}: {
  itemName: string
  onEdit: () => void
  onDelete: () => void
}) {
  const { tokens } = useTheme()

  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${itemName}`}
        hitSlop={4}
        onPress={onEdit}
        style={[styles.action, { backgroundColor: tokens.cardAlt }]}
      >
        <PencilIcon size={17} color={tokens.muted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${itemName}`}
        hitSlop={4}
        onPress={onDelete}
        style={[styles.action, { backgroundColor: tokens.cardAlt }]}
      >
        <TrashIcon size={17} color={tokens.danger} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
