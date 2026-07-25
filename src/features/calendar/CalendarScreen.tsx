import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Screen } from '@/shell/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import { useActiveHousehold, deviceTimeZone } from '@/features/household'
import { useCalendarEvents } from './useCalendarEvents'
import {
  buildMonthGrid,
  monthLabel,
  shiftMonth,
  todayKey,
} from './monthGrid'
import {
  eventDatesInRange,
  eventOccursOn,
  eventSortKey,
  type CalendarEventItem,
} from './events'
import { formatEventTime } from './datetime'
import { EventSheet } from './EventSheet'

/** Calendar destination: month grid + selected-day list, with event editing. */
export function CalendarScreen() {
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const tz = deviceTimeZone()
  const today = todayKey(tz)

  const [params, setParams] = useSearchParams()
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { year: y, month1: m }
  })
  const [selected, setSelected] = useState(today)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEventItem | null>(null)

  const events = useCalendarEvents(householdId)

  // Deep-link target from a notification: ?event=<id> opens that event.
  const deepLinkId = params.get('event')
  const eventList = useMemo(() => events.data ?? [], [events.data])
  const deepLinked = useMemo(
    () => (deepLinkId ? eventList.find((e) => e.id === deepLinkId) ?? null : null),
    [deepLinkId, eventList],
  )
  if (deepLinked && !sheetOpen && editing?.id !== deepLinked.id) {
    setEditing(deepLinked)
    setSelected(
      eventDatesInRange(deepLinked, `${cursor.year}-01-01`, `${cursor.year}-12-31`, tz)[0] ??
        selected,
    )
    setSheetOpen(true)
    const next = new URLSearchParams(params)
    next.delete('event')
    setParams(next, { replace: true })
  }

  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month1),
    [cursor],
  )

  // Which grid dates have at least one event (for the dot markers).
  const daysWithEvents = useMemo(() => {
    const rangeStart = grid[0].date
    const rangeEnd = grid[grid.length - 1].date
    const set = new Set<string>()
    for (const event of eventList) {
      for (const date of eventDatesInRange(event, rangeStart, rangeEnd, tz)) {
        set.add(date)
      }
    }
    return set
  }, [eventList, grid, tz])

  const selectedEvents = useMemo(
    () =>
      eventList
        .filter((event) => eventOccursOn(event, selected, tz))
        .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b))),
    [eventList, selected, tz],
  )

  function step(delta: number) {
    setCursor((prev) => shiftMonth(prev.year, prev.month1, delta))
  }

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEvent(event: CalendarEventItem) {
    setEditing(event)
    setSheetOpen(true)
  }

  const addButton = (
    <button
      type="button"
      onClick={openNew}
      aria-label="New event"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hh-accent)] text-white"
    >
      <PlusIcon className="h-5 w-5" />
    </button>
  )

  return (
    <Screen title="Calendar" action={addButton}>
      {household.isError ? (
        <ErrorState message="Could not load your household." />
      ) : (
        <div className="space-y-4">
          <div className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 shadow-[var(--hh-shadow-card)]">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => step(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--hh-muted)] hover:bg-[var(--hh-surface-2)]"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <h2 className="text-sm font-semibold text-[var(--hh-ink)]">
                {monthLabel(cursor.year, cursor.month1)}
              </h2>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => step(1)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--hh-muted)] hover:bg-[var(--hh-surface-2)]"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs text-[var(--hh-muted)]">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {grid.map((cell) => {
                const isSelected = cell.date === selected
                const isToday = cell.date === today
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => setSelected(cell.date)}
                    aria-pressed={isSelected}
                    aria-label={cell.date}
                    className={
                      'relative flex aspect-square flex-col items-center justify-center rounded-[10px] text-sm ' +
                      (isSelected
                        ? 'bg-[var(--hh-accent)] font-semibold text-white'
                        : cell.inMonth
                          ? 'text-[var(--hh-ink)] hover:bg-[var(--hh-surface-2)]'
                          : 'text-[var(--hh-muted)]/50')
                    }
                  >
                    <span
                      className={
                        isToday && !isSelected
                          ? 'flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-[var(--hh-accent)]'
                          : ''
                      }
                    >
                      {cell.day}
                    </span>
                    {daysWithEvents.has(cell.date) && (
                      <span
                        aria-hidden
                        className={
                          'absolute bottom-1 h-1 w-1 rounded-full ' +
                          (isSelected ? 'bg-white' : 'bg-[var(--hh-accent)]')
                        }
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <section>
            <h3 className="mb-2 px-1 text-sm font-semibold text-[var(--hh-muted)]">
              {formatDayHeading(selected)}
            </h3>
            {events.isLoading ? (
              <LoadingState />
            ) : events.isError ? (
              <ErrorState
                message="Could not load events."
                onRetry={() => void events.refetch()}
              />
            ) : selectedEvents.length === 0 ? (
              <EmptyState
                title="Nothing planned"
                hint="Tap + to add an event for this day."
              />
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => openEvent(event)}
                      className="flex w-full items-center gap-3 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 text-left shadow-[var(--hh-shadow-card)]"
                    >
                      <span className="text-sm font-medium tabular-nums text-[var(--hh-muted)]">
                        {event.allDay || !event.startsAt
                          ? 'All day'
                          : formatEventTime(event.startsAt, tz)}
                      </span>
                      <span className="flex-1 font-medium text-[var(--hh-ink)]">
                        {event.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {householdId && (
        <EventSheet
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open)
            if (!open) setEditing(null)
          }}
          householdId={householdId}
          members={household.data?.members ?? []}
          event={editing}
          defaultDate={selected}
        />
      )}
    </Screen>
  )
}

function formatDayHeading(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}
