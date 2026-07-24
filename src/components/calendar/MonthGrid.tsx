import {
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dayKey, monthGridRange, type Occurrence } from '@/lib/calendar'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MAX_DOTS = 3

interface MonthGridProps {
  month: Date
  selectedDay: Date
  occurrencesByDay: Map<string, Occurrence[]>
  colorFor: (ownerId: string | null) => string
  onSelectDay: (day: Date) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}

export function MonthGrid({
  month,
  selectedDay,
  occurrencesByDay,
  colorFor,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onToday,
}: MonthGridProps) {
  const { start, end } = monthGridRange(month)
  const days = eachDayOfInterval({ start, end })

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-[var(--text)]">
          {format(month, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Today"
            onClick={onToday}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-[var(--meta)] hover:bg-[var(--hover)]"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Previous month"
            onClick={onPrevMonth}
            className="rounded-md p-1.5 text-[var(--meta)] hover:bg-[var(--hover)]"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={onNextMonth}
            className="rounded-md p-1.5 text-[var(--meta)] hover:bg-[var(--hover)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-[11px] font-semibold tracking-wide text-[var(--meta)]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px border-t border-l border-[var(--line2)]">
        {days.map((day) => {
          const key = dayKey(day)
          const dayOccurrences = occurrencesByDay.get(key) ?? []
          const inMonth = isSameMonth(day, month)
          const selected = isSameDay(day, selectedDay)
          const today = isToday(day)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-label={format(day, 'EEEE, MMMM d')}
              aria-pressed={selected}
              className={cn(
                'flex aspect-square flex-col items-center gap-1 border-r border-b border-[var(--line2)] p-1 text-sm',
                selected ? 'bg-[var(--accentSoft)]' : 'hover:bg-[var(--hover)]',
                !inMonth && 'text-[var(--faint)]',
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs',
                  today && 'bg-[var(--accent)] font-bold text-[var(--onaccent)]',
                  inMonth && !today && 'text-[var(--text)]',
                )}
              >
                {day.getDate()}
              </span>
              <span className="flex min-h-2 flex-wrap items-center justify-center gap-0.5">
                {dayOccurrences.slice(0, MAX_DOTS).map((occ, i) => (
                  <span
                    key={`${occ.event.id}-${i}`}
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: colorFor(occ.event.owner_id) }}
                  />
                ))}
                {dayOccurrences.length > MAX_DOTS && (
                  <span className="text-[9px] leading-none text-[var(--meta)]">
                    +{dayOccurrences.length - MAX_DOTS}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
