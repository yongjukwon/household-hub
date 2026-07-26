import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { useTheme } from '@/theme/tokens'
import type { ChecklistEntry, Trip } from './data'
import { deleteChecklistEntry, saveChecklistEntry } from './mutations'

interface ChecklistSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  trip: Trip
  entry: ChecklistEntry
}

/** Edit (rename or delete) a checklist entry. Checked state toggles inline in the list. */
export function ChecklistSheet({
  open,
  onOpenChange,
  householdId,
  trip,
  entry,
}: ChecklistSheetProps) {
  const { tokens } = useTheme()
  const [labelValue, setLabelValue] = useState(entry.label)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (labelValue.trim().length === 0) {
      setError('Give this item a label.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await saveChecklistEntry(
        householdId,
        {
          id: entry.id,
          tripId: trip.id,
          label: labelValue,
          checked: entry.checked,
          sortOrder: entry.sortOrder,
        },
        entry.revision,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      onOpenChange(false)
    } catch (failure) {
      setError(
        operationThrownError(failure, 'Could not save this checklist item.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      const outcome = await deleteChecklistEntry(householdId, entry.id, entry.revision)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        setConfirmDelete(false)
        return
      }
      setConfirmDelete(false)
      onOpenChange(false)
    } catch (failure) {
      setConfirmDelete(false)
      setError(
        operationThrownError(failure, 'Could not delete this checklist item.'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Edit checklist item">
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Label</Text>
        <TextInput
          accessibilityLabel="Label"
          value={labelValue}
          onChangeText={setLabelValue}
          autoFocus
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>
      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
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
        title="Delete this item?"
        description="This removes it from the checklist. This cannot be undone."
        error={confirmDelete ? error : null}
        confirmLabel="Delete"
        confirmDisabled={saving}
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  error: { fontSize: 13, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  saveButton: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  deleteButtonText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
