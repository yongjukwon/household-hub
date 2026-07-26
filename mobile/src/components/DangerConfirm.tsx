import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { useTheme } from '@/theme/tokens'
import { BottomSheet } from './BottomSheet'

/**
 * Destructive confirmation gated on typing an exact phrase (e.g. the household
 * name or the word DELETE). Used for account/household deletion, where a single
 * tap is too easy to trigger by accident.
 */
export function DangerConfirm({
  open,
  onOpenChange,
  title,
  description,
  confirmPhrase,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmPhrase: string
  confirmLabel: string
  onConfirm: () => Promise<void> | void
}) {
  const { tokens } = useTheme()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const matches = typed.trim() === confirmPhrase

  async function handleConfirm() {
    if (!matches) return
    setBusy(true)
    try {
      await onConfirm()
      setTyped('')
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      <Text style={[styles.description, { color: tokens.muted }]}>{description}</Text>
      <Text style={[styles.description, { color: tokens.muted }]}>
        Type <Text style={{ color: tokens.ink, fontWeight: '700' }}>{confirmPhrase}</Text> to
        confirm.
      </Text>
      <TextInput
        accessibilityLabel="Confirmation phrase"
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="none"
        style={[
          styles.input,
          { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!matches || busy}
        onPress={() => void handleConfirm()}
        style={[
          styles.button,
          { backgroundColor: tokens.danger, borderRadius: tokens.radiusControl },
          (!matches || busy) && styles.disabled,
        ]}
      >
        <Text style={styles.buttonText}>{confirmLabel}</Text>
      </Pressable>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  description: { fontSize: 13.5, lineHeight: 19, marginBottom: 10 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10 },
  button: { paddingVertical: 13, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
})
