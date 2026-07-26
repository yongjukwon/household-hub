import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DateTimeField } from '@/components/DateTimeField'
import { newUuid } from '@/lib/uuid'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { useTheme } from '@/theme/tokens'
import type { ItineraryEntry, Trip } from './data'
import { deleteItineraryEntry, saveItineraryEntry } from './mutations'

function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function timeKey(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

interface ItinerarySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  trip: Trip
  entry: ItineraryEntry | null
  sortOrder: number
}

/** Add/edit a single itinerary entry (date, optional time, title, notes). */
export function ItinerarySheet({
  open,
  onOpenChange,
  householdId,
  trip,
  entry,
  sortOrder,
}: ItinerarySheetProps) {
  const { tokens } = useTheme()
  const [itemDate, setItemDate] = useState(
    new Date(`${entry?.itemDate ?? trip.startDate}T00:00:00`),
  )
  const [hasTime, setHasTime] = useState(entry?.startTime != null)
  const [startTime, setStartTime] = useState(
    new Date(`2000-01-01T${entry?.startTime ?? '09:00'}:00`),
  )
  const [title, setTitle] = useState(entry?.title ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (title.trim().length === 0) {
      setError('Give this stop a title.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await saveItineraryEntry(
        householdId,
        {
          id: entry?.id ?? newUuid(),
          tripId: trip.id,
          itemDate: dateKey(itemDate),
          startTime: hasTime ? timeKey(startTime) : null,
          title,
          notes: notes.trim().length > 0 ? notes : null,
          sortOrder: entry?.sortOrder ?? sortOrder,
        },
        entry?.revision ?? null,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      onOpenChange(false)
    } catch (failure) {
      setError(
        operationThrownError(failure, 'Could not save this itinerary entry.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!entry) return
    setSaving(true)
    try {
      const outcome = await deleteItineraryEntry(householdId, entry.id, entry.revision)
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
        operationThrownError(
          failure,
          'Could not delete this itinerary entry.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? 'Edit itinerary entry' : 'New itinerary entry'}
    >
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Title</Text>
        <TextInput
          accessibilityLabel="Title"
          value={title}
          onChangeText={setTitle}
          autoFocus
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>
      <View style={styles.field}>
        <DateTimeField
          label="Date"
          value={itemDate}
          mode="date"
          minimumDate={new Date(`${trip.startDate}T00:00:00`)}
          onChange={setItemDate}
        />
      </View>
      <View style={styles.field}>
        <View style={styles.timeHeaderRow}>
          <Text style={[styles.label, { color: tokens.muted }]}>Time (optional)</Text>
          <Pressable accessibilityRole="button" onPress={() => setHasTime(!hasTime)} hitSlop={6}>
            <Text style={[styles.toggleLink, { color: tokens.accent }]}>
              {hasTime ? 'Remove time' : 'Add a time'}
            </Text>
          </Pressable>
        </View>
        {hasTime ? (
          <DateTimeField label="" value={startTime} mode="time" onChange={setStartTime} />
        ) : null}
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Notes</Text>
        <TextInput
          accessibilityLabel="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={[
            styles.input,
            styles.textArea,
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
        {entry ? (
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
        title="Delete this entry?"
        description="This removes it from the itinerary. This cannot be undone."
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
  textArea: { textAlignVertical: 'top', minHeight: 72 },
  timeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  toggleLink: { fontSize: 12.5, fontWeight: '600' },
  error: { fontSize: 13, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  saveButton: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  deleteButtonText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
