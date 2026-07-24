import { useRef, useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { TimeSelect } from '@/components/common/TimeSelect'
import { cn } from '@/lib/utils'
import {
  useSaveCalendarEvent,
  useDeleteCalendarEvent,
} from '@/hooks/useCalendar'
import type { CalendarEvent, RecurrenceFreq } from '@/lib/calendar'
import type { HouseholdMember } from '@/hooks/useHousehold'

const controlClassName =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const FREQ_OPTIONS: { value: RecurrenceFreq; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Local date + "HH:MM" → UTC ISO. Blank time = start/end of day per `bound`. */
function isoFromLocal(
  dateStr: string,
  timeStr: string,
  bound: 'start' | 'end',
): string | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr
    ? timeStr.split(':').map(Number)
    : bound === 'end'
      ? [23, 59]
      : [0, 0]
  const dt = new Date(y, m - 1, d, hh, mm, timeStr ? 0 : bound === 'end' ? 59 : 0)
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  members: HouseholdMember[]
  currentUserId: string | null
  /** Editing when set; creating otherwise. */
  event: CalendarEvent | null
  /** Default day for a new event (the selected calendar day). */
  defaultDate: Date
}

export function EventDialog({
  open,
  onOpenChange,
  householdId,
  members,
  currentUserId,
  event,
  defaultDate,
}: EventDialogProps) {
  const start = event ? new Date(event.start_at) : defaultDate
  const end = event ? new Date(event.end_at) : defaultDate

  const [title, setTitle] = useState(event?.title ?? '')
  const [ownerId, setOwnerId] = useState<string | null>(
    event ? event.owner_id : (currentUserId ?? null),
  )
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [startDate, setStartDate] = useState(toDateStr(start))
  const [startTime, setStartTime] = useState(
    event && !event.all_day ? toTimeStr(start) : '09:00',
  )
  const [endDate, setEndDate] = useState(toDateStr(end))
  const [endTime, setEndTime] = useState(
    event && !event.all_day ? toTimeStr(end) : '10:00',
  )
  const [freq, setFreq] = useState<RecurrenceFreq>(
    event?.recurrence_freq ?? 'none',
  )
  const [until, setUntil] = useState(event?.recurrence_until ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const createId = useRef<string | null>(null)
  const saveEvent = useSaveCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()
  const pending = saveEvent.isPending || deleteEvent.isPending

  // Order owner options as You, partner(s), Shared.
  const ownerOptions: { value: string | null; label: string }[] = [
    ...[...members]
      .sort((a, b) =>
        a.userId === currentUserId ? -1 : b.userId === currentUserId ? 1 : 0,
      )
      .map((m) => ({
        value: m.userId,
        label: m.userId === currentUserId ? 'You' : m.displayName,
      })),
    { value: null, label: 'Shared' },
  ]

  function close() {
    createId.current = null
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Enter a title.')
      return
    }

    const startAt = isoFromLocal(startDate, allDay ? '' : startTime, 'start')
    const endAt = isoFromLocal(
      endDate || startDate,
      allDay ? '' : endTime,
      'end',
    )
    if (!startAt || !endAt) {
      setError('Enter a valid start and end.')
      return
    }
    if (new Date(endAt) < new Date(startAt)) {
      setError('The end must be on or after the start.')
      return
    }

    setError(null)
    try {
      createId.current ??= crypto.randomUUID()
      await saveEvent.mutateAsync({
        id: event?.id ?? createId.current,
        householdId,
        ownerId,
        title: trimmed,
        note: note.trim() || null,
        allDay,
        startAt,
        endAt,
        recurrenceFreq: freq,
        recurrenceUntil: freq === 'none' ? null : until || null,
      })
      close()
    } catch (mutationError) {
      console.error('Failed to save calendar event', mutationError)
      setError('Couldn’t save the event — check your connection and try again.')
    }
  }

  async function handleDelete() {
    if (!event) return
    const message =
      event.recurrence_freq === 'none'
        ? 'Delete this event?'
        : 'Delete this event and its entire repeating series?'
    if (!window.confirm(message)) return
    try {
      await deleteEvent.mutateAsync(event.id)
      close()
    } catch (mutationError) {
      console.error('Failed to delete calendar event', mutationError)
      setError('Couldn’t delete the event — check your connection.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? 'Edit event' : 'New event'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="calendar-event-title">Title</Label>
              <Input
                id="calendar-event-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dentist, Anniversary, Work trip…"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Whose</Label>
              <div className="flex gap-2">
                {ownerOptions.map((option) => {
                  const active = ownerId === option.value
                  return (
                    <button
                      key={option.value ?? 'shared'}
                      type="button"
                      onClick={() => setOwnerId(option.value)}
                      className={cn(
                        'flex-1 rounded-md border px-3 py-1.5 text-sm',
                        active
                          ? 'border-[var(--accent)] bg-[var(--accentSoft)] text-[var(--accent-ink)]'
                          : 'border-input text-[var(--meta)] hover:bg-[var(--hover)]',
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={allDay}
                onCheckedChange={(checked) => setAllDay(checked === true)}
              />
              All day
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="calendar-event-start-date">Start</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="calendar-event-start-date"
                  type="date"
                  className={cn(controlClassName, 'w-auto flex-1')}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                {!allDay && (
                  <TimeSelect
                    value={startTime}
                    onChange={setStartTime}
                    hourLabel="Start hour"
                    minuteLabel="Start minute"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="calendar-event-end-date">End</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="calendar-event-end-date"
                  type="date"
                  className={cn(controlClassName, 'w-auto flex-1')}
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {!allDay && (
                  <TimeSelect
                    value={endTime}
                    onChange={setEndTime}
                    hourLabel="End hour"
                    minuteLabel="End minute"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="calendar-event-repeat">Repeat</Label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id="calendar-event-repeat"
                  className={cn(controlClassName, 'w-auto flex-1')}
                  value={freq}
                  onChange={(e) =>
                    setFreq(e.target.value as RecurrenceFreq)
                  }
                >
                  {FREQ_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {freq !== 'none' && (
                  <label className="flex items-center gap-1.5 text-sm text-[var(--meta)]">
                    until
                    <input
                      type="date"
                      aria-label="Repeat until"
                      className={cn(controlClassName, 'w-auto')}
                      value={until}
                      min={startDate}
                      onChange={(e) => setUntil(e.target.value)}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="calendar-event-note">Note (optional)</Label>
              <Input
                id="calendar-event-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Location, details…"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-5 sm:justify-between">
            {event ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={pending}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
