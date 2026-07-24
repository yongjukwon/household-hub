import { format, isSameDay } from 'date-fns'
import type { CalendarEvent, Occurrence } from '@/lib/calendar'

interface DayEventListProps {
  day: Date
  occurrences: Occurrence[]
  colorFor: (ownerId: string | null) => string
  labelFor: (ownerId: string | null) => string
  onEdit: (event: CalendarEvent) => void
}

function timeLabel(occ: Occurrence): string {
  if (occ.event.all_day) {
    return isSameDay(occ.start, occ.end)
      ? 'All day'
      : `All day · until ${format(occ.end, 'MMM d')}`
  }
  if (isSameDay(occ.start, occ.end)) {
    return `${format(occ.start, 'HH:mm')}–${format(occ.end, 'HH:mm')}`
  }
  return `${format(occ.start, 'HH:mm')} → ${format(occ.end, 'MMM d, HH:mm')}`
}

export function DayEventList({
  day,
  occurrences,
  colorFor,
  labelFor,
  onEdit,
}: DayEventListProps) {
  return (
    <section className="mt-6 border-t border-[var(--line)] pt-4">
      <h3 className="text-[15px] font-semibold text-[var(--text)]">
        {format(day, 'EEEE, MMMM d')}
      </h3>

      {occurrences.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--meta)]">No events.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--line2)]">
          {occurrences.map((occ, i) => (
            <li key={`${occ.event.id}-${i}`}>
              <button
                type="button"
                onClick={() => onEdit(occ.event)}
                className="flex w-full items-start gap-3 py-3 text-left"
              >
                <span
                  aria-hidden
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorFor(occ.event.owner_id) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-[var(--text)]">
                    {occ.event.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--meta)]">
                    {timeLabel(occ)}
                    <span aria-hidden> · </span>
                    {labelFor(occ.event.owner_id)}
                    {occ.event.recurrence_freq !== 'none' && (
                      <span aria-hidden> · repeats</span>
                    )}
                  </span>
                  {occ.event.note && (
                    <span className="mt-0.5 block truncate text-xs text-[var(--meta)]">
                      {occ.event.note}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
