import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  /** Prevents repeat submission while the owning async action is in flight. */
  confirmDisabled?: boolean
  /** False for a neutral (non-red) confirm action, e.g. "Transfer ownership". */
  destructive?: boolean
}

/** Centered confirmation dialog; the confirm button reads as destructive
 * (red) by default — pass `destructive={false}` for a neutral action. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  confirmDisabled = false,
  destructive = true,
}: ConfirmDialogProps) {
  const { tokens } = useTheme()

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Cancel"
          onPress={() => onOpenChange(false)}
        />
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.card, borderRadius: tokens.radiusCard },
            tokens.shadowFloat,
          ]}
        >
          <Text style={[styles.title, { color: tokens.ink }]}>{title}</Text>
          <Text style={[styles.description, { color: tokens.muted }]}>
            {description}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenChange(false)}
              style={[styles.button, { backgroundColor: tokens.cardAlt }]}
            >
              <Text style={[styles.buttonText, { color: tokens.ink }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: confirmDisabled }}
              disabled={confirmDisabled}
              onPress={onConfirm}
              style={[
                styles.button,
                { backgroundColor: destructive ? tokens.danger : tokens.accent },
                confirmDisabled && styles.disabled,
              ]}
            >
              <Text style={[styles.buttonText, { color: destructive ? '#FFFFFF' : tokens.accentContrast }]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', maxWidth: 340, padding: 20 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  description: { fontSize: 13.5, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
})
