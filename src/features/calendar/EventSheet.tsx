import { useMemo, useState } from 'react'
import {
  reminderPresets,
  type ReminderPreset,
} from '@household-hub/domain'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import type { HouseholdMember } from '@/hooks/useHousehold'
import { deviceTimeZone } from '@/features/household'
import type { CalendarEventItem, RecurrenceFrequency } from './events'
import { utcToZonedWall, zonedWallToUtc } from './datetime'
import { saveCalendarEvent, deleteCalendarEvent, type CalendarEventForm } from './mutations'

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

const fieldClass =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const labelClass = 'block text-sm font-medium text-[var(--hh-muted)]'

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
  const tz = event?.timeZone ?? deviceTimeZone()
  const initial = useMemo(
    () => toFormState(event, defaultDate, tz),
    [event, defaultDate, tz],
  )
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
        startAt: form.allDay ? null : zonedWallToUtc(form.startWall, tz),
        endAt: form.allDay ? null : zonedWallToUtc(form.endWall, tz),
        startDate: form.allDay ? form.startDate : null,
        endDate: form.allDay ? form.endDate : null,
        timezone: tz,
        recurrenceFrequency: form.recurrenceFrequency,
        recurrenceUntil:
          form.recurrenceFrequency === 'none' ? null : form.recurrenceUntil || null,
        reminders: form.reminders,
      }
      await saveCalendarEvent(householdId, payloadForm, event?.revision ?? null)
      onOpenChange(false)
    } catch {
      setError('Could not save the event. It will retry when you reconnect.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!event) return
    setSaving(true)
    try {
      await deleteCalendarEvent(householdId, event.id, event.revision)
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
      title={event ? 'Edit event' : 'New event'}
    >
      <div className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="event-title">
            Title
          </label>
          <input
            id="event-title"
            className={fieldClass}
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="What's happening?"
            autoFocus
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--hh-ink)]">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(e) => update({ allDay: e.target.checked })}
          />
          All-day
        </label>

        {form.allDay ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="event-start-date">
                Starts
              </label>
              <input
                id="event-start-date"
                type="date"
                className={fieldClass}
                value={form.startDate}
                onChange={(e) =>
                  update({
                    startDate: e.target.value,
                    endDate:
                      form.endDate < e.target.value ? e.target.value : form.endDate,
                  })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="event-end-date">
                Ends
              </label>
              <input
                id="event-end-date"
                type="date"
                className={fieldClass}
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => update({ endDate: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelClass} htmlFor="event-start">
                Starts
              </label>
              <input
                id="event-start"
                type="datetime-local"
                className={fieldClass}
                value={form.startWall}
                onChange={(e) =>
                  update({
                    startWall: e.target.value,
                    endWall:
                      form.endWall < e.target.value ? e.target.value : form.endWall,
                  })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="event-end">
                Ends
              </label>
              <input
                id="event-end"
                type="datetime-local"
                className={fieldClass}
                value={form.endWall}
                min={form.startWall}
                onChange={(e) => update({ endWall: e.target.value })}
              />
            </div>
            <p className="text-xs text-[var(--hh-muted)]">Times in {tz}.</p>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="event-recurrence">
            Repeat
          </label>
          <select
            id="event-recurrence"
            className={fieldClass}
            value={form.recurrenceFrequency}
            onChange={(e) =>
              update({ recurrenceFrequency: e.target.value as RecurrenceFrequency })
            }
          >
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {form.recurrenceFrequency !== 'none' && (
          <div>
            <label className={labelClass} htmlFor="event-until">
              Repeat until (optional)
            </label>
            <input
              id="event-until"
              type="date"
              className={fieldClass}
              value={form.recurrenceUntil}
              onChange={(e) => update({ recurrenceUntil: e.target.value })}
            />
          </div>
        )}

        <div>
          <span className={labelClass}>Reminders</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {reminderPresets
              .filter((p) => p !== 'none')
              .map((preset) => {
                const active = form.reminders.includes(preset)
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleReminder(preset)}
                    className={
                      'rounded-full px-3 py-1 text-sm ' +
                      (active
                        ? 'bg-[var(--hh-accent)] text-white'
                        : 'bg-[var(--hh-surface-2)] text-[var(--hh-muted)]')
                    }
                  >
                    {REMINDER_LABELS[preset]}
                  </button>
                )
              })}
          </div>
        </div>

        {members.length > 0 && (
          <div>
            <label className={labelClass} htmlFor="event-owner">
              For
            </label>
            <select
              id="event-owner"
              className={fieldClass}
              value={form.ownerId ?? ''}
              onChange={(e) => update({ ownerId: e.target.value || null })}
            >
              <option value="">Both of us</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="event-note">
            Note (optional)
          </label>
          <textarea
            id="event-note"
            className={fieldClass}
            rows={2}
            value={form.note ?? ''}
            onChange={(e) => update({ note: e.target.value })}
          />
        </div>

        {error && <p className="text-sm text-[var(--hh-danger)]">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1 rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {event && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmDelete(true)}
              className="rounded-[var(--hh-radius-control)] px-4 py-2.5 font-medium text-[var(--hh-danger)]"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete event?"
        description="This removes the event for both of you. This cannot be undone."
        confirmLabel="Delete"
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
  startWall: string
  endWall: string
  startDate: string
  endDate: string
  recurrenceFrequency: RecurrenceFrequency
  recurrenceUntil: string
  reminders: ReminderPreset[]
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
      startWall: event.startsAt ? utcToZonedWall(event.startsAt, tz) : `${defaultDate}T09:00`,
      endWall: event.endsAt ? utcToZonedWall(event.endsAt, tz) : `${defaultDate}T10:00`,
      startDate: event.startDate ?? defaultDate,
      endDate: event.endDate ?? event.startDate ?? defaultDate,
      recurrenceFrequency: event.recurrenceFrequency,
      recurrenceUntil: event.recurrenceUntil ?? '',
      reminders: event.reminders,
    }
  }
  return {
    key: `new:${defaultDate}`,
    id: crypto.randomUUID(),
    ownerId: null,
    title: '',
    note: null,
    allDay: false,
    startWall: `${defaultDate}T09:00`,
    endWall: `${defaultDate}T10:00`,
    startDate: defaultDate,
    endDate: defaultDate,
    recurrenceFrequency: 'none',
    recurrenceUntil: '',
    reminders: [],
  }
}
