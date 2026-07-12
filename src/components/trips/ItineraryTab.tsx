import { MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TripItineraryItem } from '@/hooks/useTrip'

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
                    {item.start_time ? formatTime(item.start_time) : '—'}
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

export function RowMenu({
  label,
  onEdit,
  onDelete,
}: {
  label: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={label}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem
          className="text-[var(--danger)] focus:text-[var(--danger)]"
          onSelect={onDelete}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

function formatTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(1970, 0, 1, hours, minutes))
}
