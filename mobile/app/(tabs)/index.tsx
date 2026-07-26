import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Card } from '@/components/Card'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@/components/icons'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { deviceTimeZone, useActiveHousehold } from '@/features/household'
import { EventSheet } from '@/features/calendar/EventSheet'
import {
  eventDatesInRange,
  eventOccursOn,
  eventSortKey,
  type CalendarEventItem,
} from '@/features/calendar/events'
import { formatEventTime } from '@/features/calendar/datetime'
import {
  buildMonthGrid,
  monthLabel,
  shiftMonth,
  todayKey,
  type MonthGridCell,
} from '@/features/calendar/monthGrid'
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents'
import { useTheme } from '@/theme/tokens'

/** Calendar destination (default tab): month grid + selected-day agenda. */
export default function CalendarScreen() {
  const { tokens } = useTheme()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const tz = deviceTimeZone()
  const today = todayKey(tz)
  const router = useRouter()
  const params = useLocalSearchParams<{ event?: string }>()

  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { year: y, month1: m }
  })
  const [selected, setSelected] = useState(today)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEventItem | null>(null)

  const events = useCalendarEvents(householdId)
  const eventList = useMemo(() => events.data ?? [], [events.data])

  // Deep-link target from a notification: ?event=<id> opens that event.
  const deepLinkId = typeof params.event === 'string' ? params.event : null
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
    router.setParams({ event: undefined })
  }

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month1), [cursor])
  // Chunked into 7-day rows and rendered as explicit `flex:1` rows rather
  // than one flex-wrapped 42-cell grid: `${100 / 7}%` is a repeating decimal,
  // and summing seven of those percentage widths can round just over 100%,
  // which silently wraps the 7th (Saturday) column into the next row.
  const weeks = useMemo(() => {
    const rows: MonthGridCell[][] = []
    for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7))
    return rows
  }, [grid])

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

  function renderCell(cell: MonthGridCell) {
    const isSelected = cell.date === selected
    const isToday = cell.date === today
    const hasEvent = daysWithEvents.has(cell.date)
    return (
      <Pressable
        key={cell.date}
        accessibilityRole="button"
        accessibilityLabel={cell.date}
        accessibilityState={{ selected: isSelected }}
        onPress={() => setSelected(cell.date)}
        style={[
          styles.cell,
          isSelected && { backgroundColor: tokens.accent },
        ]}
      >
        <View
          style={[
            isToday && !isSelected && [styles.todayRing, { borderColor: tokens.accent }],
          ]}
        >
          <Text
            style={[
              styles.cellDay,
              {
                color: isSelected
                  ? tokens.accentContrast
                  : cell.inMonth
                    ? tokens.ink
                    : tokens.muted3,
                fontWeight: isSelected ? '800' : '400',
              },
            ]}
          >
            {cell.day}
          </Text>
        </View>
        {hasEvent ? (
          <View
            style={[
              styles.dot,
              { backgroundColor: isSelected ? tokens.accentContrast : tokens.accent },
            ]}
          />
        ) : null}
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
      <FlatList
        data={selectedEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Text
                accessibilityRole="header"
                style={[styles.pageTitle, { color: tokens.ink }]}
              >
                Schedule
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New event"
                onPress={openNew}
                style={[styles.addButton, { backgroundColor: tokens.accent }]}
              >
                <PlusIcon size={18} color={tokens.accentContrast} />
              </Pressable>
            </View>

            <View style={styles.legend}>
              <LegendItem color={tokens.ink} outline label="Yongju" tokens={tokens} />
              <LegendItem color={tokens.ink} label="Claire" outlineCircle tokens={tokens} />
              <LegendItem color={tokens.accent} label="Shared" tokens={tokens} />
            </View>

            {household.isError ? (
              <ErrorState message="Could not load your household." />
            ) : (
              <Card style={styles.monthCard}>
                <View style={styles.monthRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    onPress={() => step(-1)}
                    hitSlop={8}
                  >
                    <ChevronLeftIcon size={18} color={tokens.muted} />
                  </Pressable>
                  <Text style={[styles.monthLabel, { color: tokens.ink }]}>
                    {monthLabel(cursor.year, cursor.month1)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    onPress={() => step(1)}
                    hitSlop={8}
                  >
                    <ChevronRightIcon size={18} color={tokens.muted} />
                  </Pressable>
                </View>

                <View style={styles.weekdayRow}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <Text
                      key={d}
                      style={[styles.weekdayLabel, { color: tokens.muted2 }]}
                    >
                      {d}
                    </Text>
                  ))}
                </View>

                <View style={styles.grid}>
                  {weeks.map((week, i) => (
                    <View key={i} style={styles.weekRow}>
                      {week.map(renderCell)}
                    </View>
                  ))}
                </View>
              </Card>
            )}

            <Text style={[styles.dayHeading, { color: tokens.muted }]}>
              {formatDayHeading(selected)}
            </Text>

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
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => openEvent(item)} style={styles.eventRowWrap}>
            <Card style={styles.eventRow}>
              <Text style={[styles.eventTime, { color: tokens.muted }]}>
                {item.allDay || !item.startsAt
                  ? 'All day'
                  : formatEventTime(item.startsAt, tz)}
              </Text>
              <Text style={[styles.eventTitle, { color: tokens.ink }]}>
                {item.title}
              </Text>
            </Card>
          </Pressable>
        )}
      />

      {householdId ? (
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
      ) : null}
    </SafeAreaView>
  )
}

function LegendItem({
  color,
  label,
  outline,
  outlineCircle,
  tokens,
}: {
  color: string
  label: string
  outline?: boolean
  outlineCircle?: boolean
  tokens: ReturnType<typeof useTheme>['tokens']
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          outlineCircle
            ? { borderWidth: 2, borderColor: color, backgroundColor: 'transparent' }
            : { backgroundColor: color },
        ]}
      />
      <Text style={[styles.legendLabel, { color: tokens.muted }]}>{label}</Text>
    </View>
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 120 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: '600' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthCard: { padding: 14 },
  monthLabel: { fontSize: 14, fontWeight: '800' },
  weekdayRow: { flexDirection: 'row', marginBottom: 2 },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    paddingBottom: 4,
  },
  grid: { flexDirection: 'column' },
  weekRow: { flexDirection: 'row' },
  // flex:1 cells (not a `${100/7}%` width) — percentage widths that don't
  // divide evenly can round over 100% when summed across a row, which
  // silently wraps the 7th column into the next line. A fixed height (rather
  // than aspectRatio:1) keeps rows compact regardless of screen width.
  cell: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 10,
  },
  todayRing: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  cellDay: { fontSize: 12 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dayHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  eventRowWrap: { marginBottom: 8 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  eventTime: { fontSize: 13, fontWeight: '600' },
  eventTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
})
