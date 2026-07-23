import { BedDouble, Car, ExternalLink, Plane, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  BOOKING_TYPES,
  type BookingType,
  type TripBooking,
} from '@/hooks/useTrip'
import { BOOKING_TYPE_LABELS } from './trip-format'
import { RowMenu } from '@/components/common/RowMenu'
import { EmptyTab } from './ItineraryTab'

const BOOKING_TYPE_ICONS: Record<
  BookingType,
  typeof Plane
> = {
  flight: Plane,
  hotel: BedDouble,
  car: Car,
  other: Tag,
}

interface BookingsTabProps {
  bookings: TripBooking[]
  onAdd: () => void
  onEdit: (booking: TripBooking) => void
  onDelete: (booking: TripBooking) => void
}

export function BookingsTab({
  bookings,
  onAdd,
  onEdit,
  onDelete,
}: BookingsTabProps) {
  if (bookings.length === 0) {
    return (
      <EmptyTab
        title="No bookings yet"
        body="Keep flight, hotel, and car confirmations together for this trip."
        actionLabel="Add booking"
        onAction={onAdd}
      />
    )
  }

  const groups = BOOKING_TYPES.map(
    (type) =>
      [type, bookings.filter((booking) => booking.type === type)] as const,
  ).filter(([, typeBookings]) => typeBookings.length > 0)

  return (
    <div>
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus data-icon="inline-start" />
          Add booking
        </Button>
      </div>
      <div className="mt-3 space-y-5">
        {groups.map(([type, typeBookings]) => (
          <section key={type} aria-label={BOOKING_TYPE_LABELS[type]}>
            <h3 className="text-xs font-semibold tracking-wide text-[var(--meta)]">
              {BOOKING_TYPE_LABELS[type].toUpperCase()}
            </h3>
            <div className="mt-2 space-y-3">
              {typeBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onEdit={() => onEdit(booking)}
                  onDelete={() => onDelete(booking)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function BookingCard({
  booking,
  onEdit,
  onDelete,
}: {
  booking: TripBooking
  onEdit: () => void
  onDelete: () => void
}) {
  const Icon = BOOKING_TYPE_ICONS[booking.type]

  return (
    <section
      className="rounded-xl border border-[var(--line2)] bg-[var(--panel)] p-4"
      aria-label={booking.title}
    >
      <div className="flex items-start gap-3">
        <Icon
          className="mt-0.5 size-5 shrink-0 text-[var(--accent-ink)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-[var(--text)]">
            {booking.title}
          </h4>
          {booking.confirmation_number && (
            <p className="mt-1 text-sm text-[var(--meta)]">
              Confirmation:{' '}
              <span className="font-mono text-[var(--text)]">
                {booking.confirmation_number}
              </span>
            </p>
          )}
          {booking.confirmation_url && (
            <p className="mt-1 text-sm">
              <a
                href={booking.confirmation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[var(--accent-ink)] hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                View confirmation
              </a>
            </p>
          )}
          {(booking.starts_at || booking.ends_at) && (
            <p className="mt-1 text-sm text-[var(--meta)]">
              {formatRange(booking.starts_at, booking.ends_at)}
            </p>
          )}
          {booking.address && (
            <p className="mt-1 text-sm text-[var(--meta)]">{booking.address}</p>
          )}
          {booking.notes && (
            <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--meta)]">
              {booking.notes}
            </p>
          )}
        </div>
        <RowMenu
          label={`Actions for ${booking.title}`}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </section>
  )
}

// 24-hour clock (hourCycle 'h23') so bookings read without AM/PM. Note this
// only controls rendered output — native datetime-local pickers follow the
// device OS locale.
const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function formatRange(startsAt: string | null, endsAt: string | null): string {
  const start = startsAt ? timestampFormatter.format(new Date(startsAt)) : null
  const end = endsAt ? timestampFormatter.format(new Date(endsAt)) : null
  if (start && end) return `${start} → ${end}`
  if (start) return start
  return end ? `Until ${end}` : ''
}
