import { reminderPresets, type ReminderPreset } from '@household-hub/domain'
import { useMemo, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DateTimeField } from '@/components/DateTimeField'
import { deviceTimeZone, type HouseholdMember } from '@/features/household'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'
import { utcToZonedWall, zonedWallToUtc } from './datetime'
import type { CalendarEventItem, RecurrenceFrequency } from './events'
import { deleteCalendarEvent, saveCalendarEvent, type CalendarEventForm } from './mutations'

const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const REMINDER_LABELS: Record<ReminderPreset, string> = {
  none: 'None',
  'at-time': 'At time',
  '10m': '10 min',
  '1h': '1 hour',
  '1d': '1 day',
  '1w': '1 week',
}

interface EventSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  members: HouseholdMember[]
  /** The event being edited, or null to create on `defaultDate`. */
  event: CalendarEventItem | null
  /** Civil date (`YYYY-MM-DD`) to seed a new event with. */
  defaultDate: string
}

/** Bottom-sheet form for creating or editing a calendar event. */
export function EventSheet({
  open,
  onOpenChange,
  householdId,
  members,
  event,
  defaultDate,
}: EventSheetProps) {
  const { tokens } = useTheme()
  const tz = event?.timeZone ?? deviceTimeZone()
  const initial = useMemo(() => toFormState(event, defaultDate, tz), [event, defaultDate, tz])
  const [form, setForm] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-seed when the target event or date changes while mounted.
  const [seededFor, setSeededFor] = useState(initial.key)
  if (initial.key !== seededFor) {
    setSeededFor(initial.key)
    setForm(initial)
  }

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function toggleReminder(preset: ReminderPreset) {
    setForm((prev) => ({
      ...prev,
      reminders: prev.reminders.includes(preset)
        ? prev.reminders.filter((p) => p !== preset)
        : [...prev.reminders, preset],
    }))
  }

  async function handleSave() {
    if (form.title.trim().length === 0) {
      setError('Give the event a title.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payloadForm: CalendarEventForm = {
        id: form.id,
        ownerId: form.ownerId,
        title: form.title,
        note: form.note,
        allDay: form.allDay,
        startAt: form.allDay ? null : zonedWallToUtc(wallOf(form.start), tz),
        endAt: form.allDay ? null : zonedWallToUtc(wallOf(form.end), tz),
        startDate: form.allDay ? dateKeyOf(form.start) : null,
        endDate: form.allDay ? dateKeyOf(form.end) : null,
        timezone: tz,
        recurrenceFrequency: form.recurrenceFrequency,
        recurrenceUntil:
          form.recurrenceFrequency === 'none' ? null : form.recurrenceUntil || null,
        reminders: form.reminders,
      }
      const outcome = await saveCalendarEvent(householdId, payloadForm, event?.revision ?? null)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      onOpenChange(false)
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not save this event.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!event) return
    setSaving(true)
    setError(null)
    try {
      const outcome = await deleteCalendarEvent(householdId, event.id, event.revision)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setConfirmDelete(false)
        setError(outcomeError)
        return
      }
      setConfirmDelete(false)
      onOpenChange(false)
    } catch (failure) {
      setConfirmDelete(false)
      setError(operationThrownError(failure, 'Could not delete this event.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={event ? 'Edit event' : 'New event'}>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Title</Text>
        <TextInput
          accessibilityLabel="Title"
          value={form.title}
          onChangeText={(title) => update({ title })}
          placeholder="What's happening?"
          placeholderTextColor={tokens.muted3}
          autoFocus
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: tokens.ink }]}>All-day</Text>
        <Switch
          value={form.allDay}
          onValueChange={(allDay) => update({ allDay })}
          trackColor={{ true: tokens.accent }}
        />
      </View>

      <View style={styles.field}>
        <DateTimeField
          label="Starts"
          value={form.start}
          mode={form.allDay ? 'date' : 'datetime'}
          iosDisplay="compact"
          onChange={(start) =>
            update({ start, end: form.end < start ? start : form.end })
          }
        />
      </View>
      <View style={styles.field}>
        <DateTimeField
          label="Ends"
          value={form.end}
          mode={form.allDay ? 'date' : 'datetime'}
          minimumDate={form.start}
          iosDisplay="compact"
          onChange={(end) => update({ end })}
        />
      </View>
      {!form.allDay ? (
        <Text style={[styles.hint, { color: tokens.muted }]}>Times in {tz}.</Text>
      ) : null}

      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Repeat</Text>
        <View style={styles.chipRow}>
          {RECURRENCE_OPTIONS.map((option) => {
            const active = form.recurrenceFrequency === option.value
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => update({ recurrenceFrequency: option.value })}
                style={[
                  styles.chip,
                  { backgroundColor: active ? tokens.accent : tokens.cardAlt },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? tokens.accentContrast : tokens.muted },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {form.recurrenceFrequency !== 'none' ? (
        <View style={styles.field}>
          <DateTimeField
            label="Repeat until (optional)"
            value={form.recurrenceUntil ? new Date(`${form.recurrenceUntil}T00:00:00`) : form.start}
            mode="date"
            onChange={(date) => update({ recurrenceUntil: dateKeyOf(date) })}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Reminders</Text>
        <View style={styles.chipRow}>
          {reminderPresets
            .filter((p) => p !== 'none')
            .map((preset) => {
              const active = form.reminders.includes(preset)
              return (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => toggleReminder(preset)}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? tokens.accent : tokens.cardAlt },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? tokens.accentContrast : tokens.muted },
                    ]}
                  >
                    {REMINDER_LABELS[preset]}
                  </Text>
                </Pressable>
              )
            })}
        </View>
      </View>

      {members.length > 0 ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: tokens.muted }]}>For</Text>
          <View style={styles.chipRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: form.ownerId === null }}
              onPress={() => update({ ownerId: null })}
              style={[
                styles.chip,
                { backgroundColor: form.ownerId === null ? tokens.accent : tokens.cardAlt },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: form.ownerId === null ? tokens.accentContrast : tokens.muted },
                ]}
              >
                Both of us
              </Text>
            </Pressable>
            {members.map((member) => {
              const active = form.ownerId === member.userId
              return (
                <Pressable
                  key={member.userId}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => update({ ownerId: member.userId })}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? tokens.accent : tokens.cardAlt },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? tokens.accentContrast : tokens.muted },
                    ]}
                  >
                    {member.displayName}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Note (optional)</Text>
        <TextInput
          accessibilityLabel="Note"
          value={form.note ?? ''}
          onChangeText={(note) => update({ note })}
          multiline
          numberOfLines={2}
          style={[
            styles.input,
            styles.textarea,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>

      {error ? (
        <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text>
      ) : null}

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
          <Text style={[styles.saveButtonText, { color: tokens.accentContrast }]}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
        {event ? (
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
        title="Delete event?"
        description="This removes the event for both of you. This cannot be undone."
        error={confirmDelete ? error : null}
        confirmLabel="Delete"
        confirmDisabled={saving}
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}

interface FormState {
  key: string
  id: string
  ownerId: string | null
  title: string
  note: string | null
  allDay: boolean
  start: Date
  end: Date
  recurrenceFrequency: RecurrenceFrequency
  recurrenceUntil: string
  reminders: ReminderPreset[]
}

/** `YYYY-MM-DD` for a local `Date`, matching `defaultDate`'s civil-date space. */
function dateKeyOf(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** `YYYY-MM-DDTHH:mm` wall-clock string for a local `Date`. */
function wallOf(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${dateKeyOf(date)}T${h}:${mi}`
}

function localDateFromWall(wall: string): Date {
  const [datePart, timePart] = wall.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = (timePart ?? '00:00').split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi)
}

function toFormState(
  event: CalendarEventItem | null,
  defaultDate: string,
  tz: string,
): FormState {
  if (event) {
    return {
      key: `${event.id}:${event.revision}`,
      id: event.id,
      ownerId: event.ownerId,
      title: event.title,
      note: event.note,
      allDay: event.allDay,
      start: event.allDay
        ? localDateFromWall(`${event.startDate ?? defaultDate}T00:00`)
        : localDateFromWall(
            event.startsAt ? utcToZonedWall(event.startsAt, tz) : `${defaultDate}T09:00`,
          ),
      end: event.allDay
        ? localDateFromWall(`${event.endDate ?? event.startDate ?? defaultDate}T00:00`)
        : localDateFromWall(
            event.endsAt ? utcToZonedWall(event.endsAt, tz) : `${defaultDate}T10:00`,
          ),
      recurrenceFrequency: event.recurrenceFrequency,
      recurrenceUntil: event.recurrenceUntil ?? '',
      reminders: event.reminders,
    }
  }
  return {
    key: `new:${defaultDate}`,
    id: newUuid(),
    ownerId: null,
    title: '',
    note: null,
    allDay: false,
    start: localDateFromWall(`${defaultDate}T09:00`),
    end: localDateFromWall(`${defaultDate}T10:00`),
    recurrenceFrequency: 'none',
    recurrenceUntil: '',
    reminders: [],
  }
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textarea: { minHeight: 64, textAlignVertical: 'top' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  switchLabel: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 11.5, marginTop: 6, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '600' },
  error: { fontSize: 13.5, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  saveButton: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  deleteButtonText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
