import { MapPin, Plus, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RowMenu } from '@/components/common/RowMenu'
import type { TripItineraryItem } from '@/hooks/useTrip'

function ItemLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-ink)] hover:underline"
    >
      {children}
    </a>
  )
}

interface ItineraryTabProps {
  items: TripItineraryItem[]
  onAdd: () => void
  onEdit: (item: TripItineraryItem) => void
  onDelete: (item: TripItineraryItem) => void
}

export function ItineraryTab({
  items,
  onAdd,
  onEdit,
  onDelete,
}: ItineraryTabProps) {
  if (items.length === 0) {
    return (
      <EmptyTab
        title="No itinerary yet"
        body="Add the first activity to start planning day by day."
        actionLabel="Add itinerary item"
        onAction={onAdd}
      />
    )
  }

  const days = groupByDate(items)

  return (
    <div>
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus data-icon="inline-start" />
          Add item
        </Button>
      </div>
      <div className="mt-3 space-y-5">
        {days.map(([date, dayItems]) => (
          <section key={date} aria-label={formatDay(date)}>
            <h3 className="text-xs font-semibold tracking-wide text-[var(--meta)]">
              {formatDay(date).toUpperCase()}
            </h3>
            <ul className="mt-2 divide-y divide-[var(--line2)] rounded-xl border border-[var(--line2)] bg-[var(--panel)] px-4">
              {dayItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-3">
                  <span className="w-16 shrink-0 pt-0.5 text-xs font-medium text-[var(--meta)]">
                    {formatTimeRange(item.open_time, item.close_time)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text)]">
                      {item.title}
                    </p>
                    {item.notes && (
                      <p className="mt-0.5 text-xs whitespace-pre-wrap text-[var(--meta)]">
                        {item.notes}
                      </p>
                    )}
                    {(item.ticket_url || item.map_url) && (
                      <div className="mt-1 flex flex-wrap gap-3">
                        {item.ticket_url && (
                          <ItemLink href={item.ticket_url} label="Ticket">
                            <Ticket className="size-3.5" aria-hidden />
                            Ticket
                          </ItemLink>
                        )}
                        {item.map_url && (
                          <ItemLink href={item.map_url} label="Map">
                            <MapPin className="size-3.5" aria-hidden />
                            Map
                          </ItemLink>
                        )}
                      </div>
                    )}
                  </div>
                  <RowMenu
                    label={`Actions for ${item.title}`}
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

export function EmptyTab({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <section className="mt-10 text-center">
      <h3 className="font-semibold text-[var(--text)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--meta)]">{body}</p>
      <Button type="button" className="mt-5" onClick={onAction}>
        <Plus data-icon="inline-start" />
        {actionLabel}
      </Button>
    </section>
  )
}

function groupByDate(
  items: TripItineraryItem[],
): Array<[string, TripItineraryItem[]]> {
  const days = new Map<string, TripItineraryItem[]>()
  for (const item of items) {
    const dayItems = days.get(item.item_date)
    if (dayItems) dayItems.push(item)
    else days.set(item.item_date, [item])
  }
  return [...days.entries()]
}

function formatDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

// 24-hour clock (hourCycle 'h23'), so itinerary times read without AM/PM.
// Rendered output only — native time pickers follow the device OS locale.
function formatTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(1970, 0, 1, hours, minutes))
}

// Open/close times are both optional: show "09:00–17:00", a single time, or
// an em dash when neither is set.
function formatTimeRange(
  openTime: string | null,
  closeTime: string | null,
): string {
  const open = openTime ? formatTime(openTime) : null
  const close = closeTime ? formatTime(closeTime) : null
  if (open && close) return `${open}–${close}`
  return open ?? close ?? '—'
}
