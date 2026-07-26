import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { useTheme } from '@/theme/tokens'
import { CheckIcon, XIcon } from './icons'

interface EditableTitleProps {
  value: string
  accessibilityLabel: string
  onSave: (next: string) => Promise<string | null>
}

/** Inline title editor shared by Grocery lists and Trips: tap to edit, check
 * to save, X to cancel — mirrors the web client's `EditableTitle` exactly. */
export function EditableTitle({ value, accessibilityLabel, onSave }: EditableTitleProps) {
  const { tokens } = useTheme()
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function beginEdit() {
    setDraft(value)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setDraft(value)
    setError(null)
    setEditing(false)
  }

  async function submit() {
    if (saving) return
    const next = draft.trim()
    if (!next) {
      setError('Title cannot be blank')
      return
    }
    if (next === value) {
      setEditing(false)
      setError(null)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saveError = await onSave(next)
      if (saveError) {
        setError(saveError)
        return
      }
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={beginEdit}
        style={styles.readRow}
      >
        <Text style={[styles.title, { color: tokens.ink }]}>{value}</Text>
      </Pressable>
    )
  }

  return (
    <View>
      <View style={styles.editRow}>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          value={draft}
          editable={!saving}
          onChangeText={setDraft}
          onSubmitEditing={() => void submit()}
          autoFocus
          style={[
            styles.input,
            { borderColor: tokens.accent, color: tokens.ink, borderRadius: tokens.radiusControl },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save title"
          disabled={saving}
          onPress={() => void submit()}
          style={styles.iconButton}
        >
          <CheckIcon size={18} color={tokens.accent} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel title edit"
          disabled={saving}
          onPress={cancel}
          style={styles.iconButton}
        >
          <XIcon size={18} color={tokens.muted} />
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: tokens.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  readRow: { flexShrink: 1 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 20,
    fontWeight: '800',
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { fontSize: 13, marginTop: 4 },
})
