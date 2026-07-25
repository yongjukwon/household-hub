import { useState } from 'react'
import { isCurrencyCode } from '@household-hub/domain'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { deviceTimeZone } from '@/features/household'
import { operationOutcomeError } from '@/lib/operations/outcome'
import type { Trip } from './data'
import { normalizeCurrencyInput } from './forms'
import { deleteTrip, saveTrip } from './mutations'

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const label = 'block text-sm font-medium text-[var(--hh-muted)]'

// A short curated list; any valid IANA name may still be typed.
const COMMON_ZONES = [
  'America/Toronto',
  'America/Vancouver',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Bangkok',
  'Australia/Sydney',
]

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

interface TripSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  trip: Trip | null
}

/** Create or edit a trip (destination, dates, timezone, currency). */
export function TripSheet({ open, onOpenChange, householdId, trip }: TripSheetProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState(trip?.name ?? '')
  const [destination, setDestination] = useState(trip?.destination ?? '')
  const [currency, setCurrency] = useState(
    normalizeCurrencyInput(trip?.destinationCurrency ?? 'CAD'),
  )
  const [timezone, setTimezone] = useState(trip?.destinationTimezone ?? deviceTimeZone())
  const [startDate, setStartDate] = useState(trip?.startDate ?? today)
  const [endDate, setEndDate] = useState(trip?.endDate ?? today)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (name.trim().length === 0 || destination.trim().length === 0) {
      setError('Give the trip a name and destination.')
      return
    }
    if (endDate < startDate) {
      setError('The end date must be on or after the start date.')
      return
    }
    if (!isCurrencyCode(currency)) {
      setError('Enter a valid three-letter ISO currency code.')
      return
    }
    if (!isTimeZone(timezone)) {
      setError('Enter a valid IANA destination timezone.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await saveTrip(
        householdId,
        {
          id: trip?.id ?? crypto.randomUUID(),
          name,
          destination,
          timezone,
          startDate,
          endDate,
          destinationCurrency: currency,
        },
        trip?.revision ?? null,
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
    if (!trip) return
    setSaving(true)
    try {
      const outcome = await deleteTrip(householdId, trip.id, trip.revision)
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
    <BottomSheet open={open} onOpenChange={onOpenChange} title={trip ? 'Edit trip' : 'New trip'}>
      <div className="space-y-3">
        <div>
          <label className={label} htmlFor="trip-name">
            Name
          </label>
          <input id="trip-name" className={field} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <fieldset className="space-y-3 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface-2)] p-3">
          <legend className="px-1 text-sm font-semibold text-[var(--hh-ink)]">
            Destination setup
          </legend>
          <div>
            <label className={label} htmlFor="trip-destination">
              City or destination
            </label>
            <input
              id="trip-destination"
              className={field}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="trip-tz">
              Destination timezone
            </label>
            <input
              id="trip-tz"
              className={field}
              value={timezone}
              list="trip-tz-options"
              onChange={(e) => setTimezone(e.target.value)}
            />
            <datalist id="trip-tz-options">
              {COMMON_ZONES.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={label} htmlFor="trip-currency">
              Destination currency
            </label>
            <input
              id="trip-currency"
              className={field}
              value={currency}
              maxLength={3}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => setCurrency(normalizeCurrencyInput(e.target.value))}
            />
          </div>
          {destination.trim() && timezone.trim() && currency && (
            <p className="text-sm font-medium text-[var(--hh-muted)]">
              {destination.trim()} · {timezone.trim()} · {currency}
            </p>
          )}
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="trip-start">
              Start
            </label>
            <input
              id="trip-start"
              type="date"
              className={field}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (endDate < e.target.value) setEndDate(e.target.value)
              }}
            />
          </div>
          <div>
            <label className={label} htmlFor="trip-end">
              End
            </label>
            <input
              id="trip-end"
              type="date"
              className={field}
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
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
          {trip && (
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
        title="Delete trip?"
        description="This removes the trip and its expenses. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}
