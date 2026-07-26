import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DateTimeField } from '@/components/DateTimeField'
import { SelectField } from '@/components/SelectField'
import { utcToZonedWall, zonedWallToUtc } from '@/features/calendar/datetime'
import { newUuid } from '@/lib/uuid'
import { operationOutcomeError } from '@/lib/operations'
import { useTheme } from '@/theme/tokens'
import type { BookingEntry, BookingKind, Trip } from './data'
import { deleteBookingEntry, saveBookingEntry } from './mutations'

const KINDS: { value: BookingKind; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'car', label: 'Car' },
  { value: 'other', label: 'Other' },
]

/** Parses a `YYYY-MM-DDTHH:mm` wall string into a Date using its numeric fields as local components (not a real instant conversion). */
function parseWall(wall: string): Date {
  const [datePart, timePart] = wall.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi)
}

/** Inverse of `parseWall`: reads a Date's local numeric fields back into a `YYYY-MM-DDTHH:mm` wall string. */
function wallKey(date: Date): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:${mi}`
}

interface BookingSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  trip: Trip
  entry: BookingEntry | null
  sortOrder: number
}

/** Add/edit a booking (flight/hotel/car/other), times shown in the trip's destination timezone. */
export function BookingSheet({
  open,
  onOpenChange,
  householdId,
  trip,
  entry,
  sortOrder,
}: BookingSheetProps) {
  const { tokens } = useTheme()
  const tz = trip.destinationTimezone
  const [kind, setKind] = useState<BookingKind>(entry?.kind ?? 'flight')
  const [title, setTitle] = useState(entry?.title ?? '')
  const [confirmationNumber, setConfirmationNumber] = useState(entry?.confirmationNumber ?? '')
  const [address, setAddress] = useState(entry?.address ?? '')
  const [hasStarts, setHasStarts] = useState(entry?.startsAt != null)
  const [startsAt, setStartsAt] = useState(
    entry?.startsAt
      ? parseWall(utcToZonedWall(entry.startsAt, tz))
      : new Date(`${trip.startDate}T12:00:00`),
  )
  const [hasEnds, setHasEnds] = useState(entry?.endsAt != null)
  const [endsAt, setEndsAt] = useState(
    entry?.endsAt
      ? parseWall(utcToZonedWall(entry.endsAt, tz))
      : new Date(`${trip.startDate}T12:00:00`),
  )
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (title.trim().length === 0) {
      setError('Give this booking a title.')
      return
    }
    const startsIso = hasStarts ? zonedWallToUtc(wallKey(startsAt), tz) : null
    const endsIso = hasEnds ? zonedWallToUtc(wallKey(endsAt), tz) : null
    if (startsIso && endsIso && endsIso < startsIso) {
      setError('The end time must be on or after the start time.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await saveBookingEntry(
        householdId,
        {
          id: entry?.id ?? newUuid(),
          tripId: trip.id,
          kind,
          title,
          confirmationNumber: confirmationNumber.trim().length > 0 ? confirmationNumber : null,
          address: address.trim().length > 0 ? address : null,
          startsAt: startsIso,
          endsAt: endsIso,
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
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!entry) return
    setSaving(true)
    try {
      const outcome = await deleteBookingEntry(householdId, entry.id, entry.revision)
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
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? 'Edit booking' : 'New booking'}
    >
      <View style={styles.field}>
        <SelectField
          label="Type"
          value={kind}
          onChange={(next) => setKind(next as BookingKind)}
          options={KINDS}
        />
      </View>
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
        <View style={styles.timeHeaderRow}>
          <Text style={[styles.label, { color: tokens.muted }]}>Starts ({tz})</Text>
          <Pressable accessibilityRole="button" onPress={() => setHasStarts(!hasStarts)} hitSlop={6}>
            <Text style={[styles.toggleLink, { color: tokens.accent }]}>
              {hasStarts ? 'Remove' : 'Add'}
            </Text>
          </Pressable>
        </View>
        {hasStarts ? (
          <DateTimeField label="" value={startsAt} mode="datetime" onChange={setStartsAt} />
        ) : null}
      </View>
      <View style={styles.field}>
        <View style={styles.timeHeaderRow}>
          <Text style={[styles.label, { color: tokens.muted }]}>Ends ({tz})</Text>
          <Pressable accessibilityRole="button" onPress={() => setHasEnds(!hasEnds)} hitSlop={6}>
            <Text style={[styles.toggleLink, { color: tokens.accent }]}>
              {hasEnds ? 'Remove' : 'Add'}
            </Text>
          </Pressable>
        </View>
        {hasEnds ? (
          <DateTimeField label="" value={endsAt} mode="datetime" onChange={setEndsAt} />
        ) : null}
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Confirmation number</Text>
        <TextInput
          accessibilityLabel="Confirmation number"
          value={confirmationNumber}
          onChangeText={setConfirmationNumber}
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Address</Text>
        <TextInput
          accessibilityLabel="Address"
          value={address}
          onChangeText={setAddress}
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
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
        title="Delete this booking?"
        description="This cannot be undone."
        confirmLabel="Delete"
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
