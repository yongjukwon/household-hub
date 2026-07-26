import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { operationOutcomeError } from '@/lib/operations/outcome'
import { utcToZonedWall, zonedWallToUtc } from '@/features/calendar/datetime'
import type { BookingEntry, BookingKind, Trip } from './data'
import { deleteBookingEntry, saveBookingEntry } from './mutations'

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const label = 'block text-sm font-medium text-[var(--hh-muted)]'

const KINDS: { value: BookingKind; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'car', label: 'Car' },
  { value: 'other', label: 'Other' },
]

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
  const tz = trip.destinationTimezone
  const [kind, setKind] = useState<BookingKind>(entry?.kind ?? 'flight')
  const [title, setTitle] = useState(entry?.title ?? '')
  const [confirmationNumber, setConfirmationNumber] = useState(entry?.confirmationNumber ?? '')
  const [address, setAddress] = useState(entry?.address ?? '')
  const [startsAt, setStartsAt] = useState(
    entry?.startsAt ? utcToZonedWall(entry.startsAt, tz) : '',
  )
  const [endsAt, setEndsAt] = useState(entry?.endsAt ? utcToZonedWall(entry.endsAt, tz) : '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (title.trim().length === 0) {
      setError('Give this booking a title.')
      return
    }
    const startsIso = startsAt.trim().length > 0 ? zonedWallToUtc(startsAt, tz) : null
    const endsIso = endsAt.trim().length > 0 ? zonedWallToUtc(endsAt, tz) : null
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
          id: entry?.id ?? crypto.randomUUID(),
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
      <div className="space-y-3">
        <div>
          <label className={label} htmlFor="booking-kind">
            Type
          </label>
          <select
            id="booking-kind"
            className={field}
            value={kind}
            onChange={(e) => setKind(e.target.value as BookingKind)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="booking-title">
            Title
          </label>
          <input
            id="booking-title"
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="booking-starts">
              Starts ({tz})
            </label>
            <input
              id="booking-starts"
              type="datetime-local"
              className={field}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="booking-ends">
              Ends ({tz})
            </label>
            <input
              id="booking-ends"
              type="datetime-local"
              className={field}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="booking-confirmation">
            Confirmation number
          </label>
          <input
            id="booking-confirmation"
            className={field}
            value={confirmationNumber}
            onChange={(e) => setConfirmationNumber(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="booking-address">
            Address
          </label>
          <input
            id="booking-address"
            className={field}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="booking-notes">
            Notes
          </label>
          <textarea
            id="booking-notes"
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
        title="Delete this booking?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}
