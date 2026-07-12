import { useRef, useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BOOKING_TYPES,
  useCreateBooking,
  useCreateItineraryItem,
  useUpdateBooking,
  useUpdateChecklistItem,
  useUpdateItineraryItem,
  type BookingType,
  type TripBooking,
  type TripChecklistItem,
  type TripItineraryItem,
} from '@/hooks/useTrip'
import { useUpdatePageDates } from '@/hooks/usePages'
import {
  BOOKING_TYPE_LABELS,
  daysInRange,
  formatDayOption,
  isoToLocalInput,
  localInputToIso,
  normalizeUrl,
} from './trip-format'

const selectClassName =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const textareaClassName =
  'min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

interface ItineraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  item: TripItineraryItem | null
  nextSortOrder: number
  /** Trip period; when both set, the date field is a dropdown of its days. */
  startDate: string | null
  endDate: string | null
}

export function ItineraryDialog({
  open,
  onOpenChange,
  pageId,
  item,
  nextSortOrder,
  startDate,
  endDate,
}: ItineraryDialogProps) {
  // Days in the trip period; when editing an item dated outside the range,
  // keep its date selectable so it isn't silently changed.
  const periodDays = daysInRange(startDate, endDate)
  const dayOptions =
    item && item.item_date && !periodDays.includes(item.item_date)
      ? [item.item_date, ...periodDays]
      : periodDays
  const [itemDate, setItemDate] = useState(
    item?.item_date ?? (periodDays.length > 0 ? periodDays[0] : ''),
  )
  const [openTime, setOpenTime] = useState(item?.open_time?.slice(0, 5) ?? '')
  const [closeTime, setCloseTime] = useState(
    item?.close_time?.slice(0, 5) ?? '',
  )
  const [title, setTitle] = useState(item?.title ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [ticketUrl, setTicketUrl] = useState(item?.ticket_url ?? '')
  const [mapUrl, setMapUrl] = useState(item?.map_url ?? '')
  const [error, setError] = useState<string | null>(null)
  const createId = useRef<string | null>(null)
  const createItem = useCreateItineraryItem()
  const updateItem = useUpdateItineraryItem()
  const pending = createItem.isPending || updateItem.isPending

  function close() {
    createId.current = null
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!itemDate || !trimmedTitle) {
      setError('Pick a date and enter a title.')
      return
    }
    if (openTime && closeTime && closeTime < openTime) {
      setError('The close time can’t be before the open time.')
      return
    }
    const ticket = normalizeUrl(ticketUrl)
    const map = normalizeUrl(mapUrl)
    if (ticket === undefined || map === undefined) {
      setError('Enter valid links (starting with http:// or https://).')
      return
    }

    const input = {
      id: item?.id ?? (createId.current ??= crypto.randomUUID()),
      pageId,
      itemDate,
      openTime: openTime || null,
      closeTime: closeTime || null,
      title: trimmedTitle,
      notes: notes.trim() || null,
      ticketUrl: ticket,
      mapUrl: map,
      sortOrder: item?.sort_order ?? nextSortOrder,
    }

    setError(null)
    try {
      if (item) await updateItem.mutateAsync(input)
      else await createItem.mutateAsync(input)
      close()
    } catch (mutationError) {
      console.error('Failed to save itinerary item', mutationError)
      setError('Couldn’t save this item — check your connection and try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? 'Edit itinerary item' : 'New itinerary item'}
          </DialogTitle>
          <DialogDescription>
            Plan one activity for a day of the trip.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="itinerary-date">Date</Label>
              {dayOptions.length > 0 ? (
                <select
                  id="itinerary-date"
                  className={selectClassName}
                  value={itemDate}
                  onChange={(event) => setItemDate(event.target.value)}
                  required
                >
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>
                      {formatDayOption(day)}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="itinerary-date"
                  type="date"
                  value={itemDate}
                  onChange={(event) => setItemDate(event.target.value)}
                  required
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="itinerary-open">Opens</Label>
                <Input
                  id="itinerary-open"
                  type="time"
                  value={openTime}
                  onChange={(event) => setOpenTime(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="itinerary-close">Closes</Label>
                <Input
                  id="itinerary-close"
                  type="time"
                  value={closeTime}
                  onChange={(event) => setCloseTime(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="itinerary-title">Title</Label>
              <Input
                id="itinerary-title"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-invalid={!!error && !title.trim()}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="itinerary-ticket">Ticket link</Label>
              <Input
                id="itinerary-ticket"
                inputMode="url"
                value={ticketUrl}
                onChange={(event) => setTicketUrl(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="itinerary-map">Map link</Label>
              <Input
                id="itinerary-map"
                inputMode="url"
                value={mapUrl}
                onChange={(event) => setMapUrl(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="itinerary-notes">Notes</Label>
              <textarea
                id="itinerary-notes"
                className={textareaClassName}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional"
              />
            </div>
            {error && (
              <p
                id="itinerary-error"
                role="alert"
                className="text-sm text-[var(--danger)]"
              >
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : item ? 'Save' : 'Add item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface BookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  booking: TripBooking | null
  nextSortOrder: number
}

export function BookingDialog({
  open,
  onOpenChange,
  pageId,
  booking,
  nextSortOrder,
}: BookingDialogProps) {
  const [type, setType] = useState<BookingType>(booking?.type ?? 'flight')
  const [title, setTitle] = useState(booking?.title ?? '')
  const [confirmationNumber, setConfirmationNumber] = useState(
    booking?.confirmation_number ?? '',
  )
  const [confirmationUrl, setConfirmationUrl] = useState(
    booking?.confirmation_url ?? '',
  )
  const [address, setAddress] = useState(booking?.address ?? '')
  const [startsAt, setStartsAt] = useState(
    isoToLocalInput(booking?.starts_at ?? null),
  )
  const [endsAt, setEndsAt] = useState(isoToLocalInput(booking?.ends_at ?? null))
  const [notes, setNotes] = useState(booking?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const createId = useRef<string | null>(null)
  const createBooking = useCreateBooking()
  const updateBooking = useUpdateBooking()
  const pending = createBooking.isPending || updateBooking.isPending

  function close() {
    createId.current = null
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Enter a booking title.')
      return
    }
    const startsAtIso = localInputToIso(startsAt)
    const endsAtIso = localInputToIso(endsAt)
    if (startsAtIso && endsAtIso && endsAtIso < startsAtIso) {
      setError('The end time can’t be before the start time.')
      return
    }
    const confirmation = normalizeUrl(confirmationUrl)
    if (confirmation === undefined) {
      setError('Enter a valid confirmation link (http:// or https://).')
      return
    }

    const input = {
      id: booking?.id ?? (createId.current ??= crypto.randomUUID()),
      pageId,
      type,
      title: trimmedTitle,
      confirmationNumber: confirmationNumber.trim() || null,
      confirmationUrl: confirmation,
      address: address.trim() || null,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      notes: notes.trim() || null,
      sortOrder: booking?.sort_order ?? nextSortOrder,
    }

    setError(null)
    try {
      if (booking) await updateBooking.mutateAsync(input)
      else await createBooking.mutateAsync(input)
      close()
    } catch (mutationError) {
      console.error('Failed to save booking', mutationError)
      setError(
        'Couldn’t save this booking — check your connection and try again.',
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{booking ? 'Edit booking' : 'New booking'}</DialogTitle>
          <DialogDescription>
            Keep the confirmation details in one place.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="booking-type">Type</Label>
              <select
                id="booking-type"
                className={selectClassName}
                value={type}
                onChange={(event) =>
                  setType(event.target.value as BookingType)
                }
                required
              >
                {BOOKING_TYPES.map((bookingType) => (
                  <option key={bookingType} value={bookingType}>
                    {BOOKING_TYPE_LABELS[bookingType]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-title">Title</Label>
              <Input
                id="booking-title"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-invalid={!!error && !title.trim()}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-confirmation">Confirmation number</Label>
              <Input
                id="booking-confirmation"
                value={confirmationNumber}
                onChange={(event) => setConfirmationNumber(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-confirmation-url">Confirmation link</Label>
              <Input
                id="booking-confirmation-url"
                inputMode="url"
                value={confirmationUrl}
                onChange={(event) => setConfirmationUrl(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-address">Address</Label>
              <Input
                id="booking-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="booking-starts">Starts</Label>
                <Input
                  id="booking-starts"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="booking-ends">Ends</Label>
                <Input
                  id="booking-ends"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-notes">Notes</Label>
              <textarea
                id="booking-notes"
                className={textareaClassName}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : booking ? 'Save' : 'Add booking'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface ChecklistItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  item: TripChecklistItem
}

export function ChecklistItemDialog({
  open,
  onOpenChange,
  pageId,
  item,
}: ChecklistItemDialogProps) {
  const [label, setLabel] = useState(item.label)
  const [error, setError] = useState<string | null>(null)
  const updateItem = useUpdateChecklistItem()

  function close() {
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      setError('Enter a label.')
      return
    }

    setError(null)
    try {
      await updateItem.mutateAsync({
        id: item.id,
        pageId,
        label: trimmedLabel,
      })
      close()
    } catch (mutationError) {
      console.error('Failed to rename checklist item', mutationError)
      setError('Couldn’t save this item — check your connection and try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit checklist item</DialogTitle>
          <DialogDescription>Rename this packing/to-do item.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="checklist-label">Label</Label>
              <Input
                id="checklist-label"
                autoFocus
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                aria-invalid={!!error}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateItem.isPending}>
              {updateItem.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface TripDatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  startDate: string | null
  endDate: string | null
}

export function TripDatesDialog({
  open,
  onOpenChange,
  pageId,
  startDate,
  endDate,
}: TripDatesDialogProps) {
  const [start, setStart] = useState(startDate ?? '')
  const [end, setEnd] = useState(endDate ?? '')
  const [error, setError] = useState<string | null>(null)
  const updateDates = useUpdatePageDates()

  function close() {
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (start && end && end < start) {
      setError('The end date can’t be before the start date.')
      return
    }
    setError(null)
    try {
      await updateDates.mutateAsync({
        pageId,
        startDate: start || null,
        endDate: end || null,
      })
      close()
    } catch (mutationError) {
      console.error('Failed to update trip dates', mutationError)
      setError('Couldn’t save the dates — check your connection and try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trip dates</DialogTitle>
          <DialogDescription>
            Set the trip period; itinerary items pick their day within it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trip-start-date">Start</Label>
              <Input
                id="trip-start-date"
                type="date"
                value={start}
                max={end || undefined}
                onChange={(event) => setStart(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-end-date">End</Label>
              <Input
                id="trip-end-date"
                type="date"
                value={end}
                min={start || undefined}
                onChange={(event) => setEnd(event.target.value)}
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateDates.isPending}>
              {updateDates.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
