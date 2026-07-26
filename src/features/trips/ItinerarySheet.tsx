import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { operationOutcomeError } from '@/lib/operations/outcome'
import type { ItineraryEntry, Trip } from './data'
import { deleteItineraryEntry, saveItineraryEntry } from './mutations'

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const label = 'block text-sm font-medium text-[var(--hh-muted)]'

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
  const [itemDate, setItemDate] = useState(entry?.itemDate ?? trip.startDate)
  const [startTime, setStartTime] = useState(entry?.startTime ?? '')
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
          id: entry?.id ?? crypto.randomUUID(),
          tripId: trip.id,
          itemDate,
          startTime: startTime.trim().length > 0 ? startTime : null,
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
      <div className="space-y-3">
        <div>
          <label className={label} htmlFor="itin-title">
            Title
          </label>
          <input
            id="itin-title"
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="itin-date">
              Date
            </label>
            <input
              id="itin-date"
              type="date"
              className={field}
              value={itemDate}
              min={trip.startDate}
              max={trip.endDate}
              onChange={(e) => setItemDate(e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="itin-time">
              Time (optional)
            </label>
            <input
              id="itin-time"
              type="time"
              className={field}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="itin-notes">
            Notes
          </label>
          <textarea
            id="itin-notes"
            className={field}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
            Save
          </button>
          {entry && (
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
        title="Delete this entry?"
        description="This removes it from the itinerary. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}
