import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/hooks/useHousehold'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { calendarKeys, useCalendarEvents } from '@/hooks/useCalendar'
import {
  buildOwnerColors,
  dayKey,
  expandOccurrences,
  monthGridRange,
  type CalendarEvent,
  type Occurrence,
} from '@/lib/calendar'
import { MonthGrid } from '@/components/calendar/MonthGrid'
import { DayEventList } from '@/components/calendar/DayEventList'
import { EventDialog } from '@/components/calendar/EventDialog'

const EMPTY_EVENTS: CalendarEvent[] = []

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()))
  const [dialog, setDialog] = useState<{ event: CalendarEvent | null } | null>(
    null,
  )

  const { user } = useAuth()
  const { data: household } = useHousehold()
  const eventsQuery = useCalendarEvents()

  useRealtimeTable(
    'calendar_events',
    'household_id',
    household?.id ?? '',
    calendarKeys.events(),
  )

  const events = eventsQuery.data ?? EMPTY_EVENTS

  const ownerColors = useMemo(
    () => buildOwnerColors(household?.members ?? [], user?.id ?? null),
    [household?.members, user?.id],
  )

  const range = useMemo(() => monthGridRange(month), [month])

  // One occurrence spread across every grid day it covers, so multi-day and
  // all-day-multi events show on each spanned day (grid + day list).
  const occurrencesByDay = useMemo(() => {
    const occurrences = expandOccurrences(events, range.start, range.end)
    const map = new Map<string, Occurrence[]>()
    for (const occ of occurrences) {
      const first =
        startOfDay(occ.start) < range.start ? range.start : startOfDay(occ.start)
      const last =
        startOfDay(occ.end) > range.end ? range.end : startOfDay(occ.end)
      for (const day of eachDayOfInterval({ start: first, end: last })) {
        const key = dayKey(day)
        const list = map.get(key) ?? []
        list.push(occ)
        map.set(key, list)
      }
    }
    return map
  }, [events, range.start, range.end])

  const selectedOccurrences = occurrencesByDay.get(dayKey(selectedDay)) ?? []

  function goMonth(delta: number) {
    const next = startOfMonth(addMonths(month, delta))
    setMonth(next)
    setSelectedDay(next)
  }

  function goToday() {
    const today = new Date()
    setMonth(startOfMonth(today))
    setSelectedDay(startOfDay(today))
  }

  function selectDay(day: Date) {
    setSelectedDay(startOfDay(day))
    if (!isSameMonth(day, month)) setMonth(startOfMonth(day))
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
          Calendar
        </h1>
        <Button
          type="button"
          variant="outline"
          disabled={!household}
          onClick={() => setDialog({ event: null })}
        >
          <Plus data-icon="inline-start" />
          New event
        </Button>
      </header>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {ownerColors.legend.map((entry) => (
          <span
            key={entry.label}
            className="flex items-center gap-1.5 text-xs text-[var(--meta)]"
          >
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.label}
          </span>
        ))}
      </div>

      {eventsQuery.isError ? (
        <div className="mt-12 text-center">
          <p role="alert" className="text-sm text-[var(--danger)]">
            Couldn’t load the calendar — check your connection and try again.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void eventsQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <MonthGrid
              month={month}
              selectedDay={selectedDay}
              occurrencesByDay={occurrencesByDay}
              colorFor={ownerColors.colorFor}
              onSelectDay={selectDay}
              onPrevMonth={() => goMonth(-1)}
              onNextMonth={() => goMonth(1)}
              onToday={goToday}
            />
          </div>

          <DayEventList
            day={selectedDay}
            occurrences={selectedOccurrences}
            colorFor={ownerColors.colorFor}
            labelFor={ownerColors.labelFor}
            onEdit={(event) => setDialog({ event })}
          />
        </>
      )}

      {dialog && household && (
        <EventDialog
          key={dialog.event?.id ?? 'new-event'}
          open
          onOpenChange={(next) => {
            if (!next) setDialog(null)
          }}
          householdId={household.id}
          members={household.members}
          currentUserId={user?.id ?? null}
          event={dialog.event}
          defaultDate={selectedDay}
        />
      )}
    </div>
  )
}
