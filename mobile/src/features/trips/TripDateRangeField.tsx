import { useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/components/icons'
import {
  buildMonthGrid,
  datesInSpan,
  monthLabel,
  shiftMonth,
} from '@/features/calendar/monthGrid'
import { useTheme } from '@/theme/tokens'
import {
  formatTripDateRange,
  monthFromDateKey,
  selectTripRangeDate,
  type TripDateRange,
} from './dateRange'

interface TripDateRangeFieldProps {
  startDate: string
  endDate: string
  onChange: (range: { startDate: string; endDate: string }) => void
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function dateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

/** One compact Trip field backed by a dedicated single-calendar range modal. */
export function TripDateRangeField({
  startDate,
  endDate,
  onChange,
}: TripDateRangeFieldProps) {
  const { tokens } = useTheme()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<TripDateRange>({
    startDate,
    endDate,
  })
  const [visibleMonth, setVisibleMonth] = useState(
    monthFromDateKey(startDate),
  )

  const cells = useMemo(
    () => buildMonthGrid(visibleMonth.year, visibleMonth.month1),
    [visibleMonth],
  )
  const rangeDates = useMemo(
    () =>
      new Set(
        draft.endDate
          ? datesInSpan(draft.startDate, draft.endDate)
          : [draft.startDate],
      ),
    [draft],
  )

  function showCalendar() {
    setDraft({ startDate, endDate })
    setVisibleMonth(monthFromDateKey(startDate))
    setOpen(true)
  }

  function closeWithoutSaving() {
    setOpen(false)
  }

  function commit() {
    if (!draft.endDate) return
    onChange({ startDate: draft.startDate, endDate: draft.endDate })
    setOpen(false)
  }

  function moveMonth(delta: number) {
    setVisibleMonth((current) =>
      shiftMonth(current.year, current.month1, delta),
    )
  }

  return (
    <View>
      <Text style={[styles.label, { color: tokens.muted }]}>Trip dates</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Trip dates"
        onPress={showCalendar}
        style={[
          styles.field,
          {
            borderColor: tokens.line,
            borderRadius: tokens.radiusControl,
            backgroundColor: tokens.card,
          },
        ]}
      >
        <Text style={[styles.fieldValue, { color: tokens.ink }]}>
          {formatTripDateRange(startDate, endDate)}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeWithoutSaving}
      >
        <SafeAreaView
          style={[styles.modal, { backgroundColor: tokens.canvas }]}
        >
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={closeWithoutSaving}
              style={styles.headerAction}
            >
              <Text style={[styles.headerActionText, { color: tokens.muted }]}>
                Cancel
              </Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: tokens.ink }]}>
              Trip dates
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              disabled={!draft.endDate}
              onPress={commit}
              style={styles.headerAction}
            >
              <Text
                style={[
                  styles.headerActionText,
                  { color: tokens.accent },
                  !draft.endDate && styles.disabledText,
                ]}
              >
                Done
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.calendar,
              {
                backgroundColor: tokens.card,
                borderRadius: tokens.radiusCard,
              },
              tokens.shadowCard,
            ]}
          >
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => moveMonth(-1)}
                style={styles.monthButton}
              >
                <ChevronLeftIcon size={20} color={tokens.muted} />
              </Pressable>
              <Text style={[styles.monthTitle, { color: tokens.ink }]}>
                {monthLabel(visibleMonth.year, visibleMonth.month1)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => moveMonth(1)}
                style={styles.monthButton}
              >
                <ChevronRightIcon size={20} color={tokens.muted} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((day) => (
                <Text
                  key={day}
                  style={[styles.weekday, { color: tokens.muted }]}
                >
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((cell) => {
                const endpoint =
                  cell.date === draft.startDate ||
                  cell.date === draft.endDate
                const inRange = rangeDates.has(cell.date)
                return (
                  <View
                    key={cell.date}
                    style={[
                      styles.daySlot,
                      inRange &&
                        !endpoint && { backgroundColor: tokens.accentSoft },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${dateLabel(cell.date)}`}
                      accessibilityState={{ selected: inRange }}
                      onPress={() =>
                        setDraft((current) =>
                          selectTripRangeDate(current, cell.date),
                        )
                      }
                      style={[
                        styles.dayButton,
                        endpoint && { backgroundColor: tokens.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: endpoint
                              ? tokens.accentContrast
                              : cell.inMonth
                                ? tokens.ink
                                : tokens.muted3,
                          },
                          endpoint && styles.endpointText,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>
          </View>

          <Text style={[styles.hint, { color: tokens.muted }]}>
            {!draft.endDate
              ? 'Choose the end date.'
              : formatTripDateRange(draft.startDate, draft.endDate)}
          </Text>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  field: {
    minHeight: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  fieldValue: { fontSize: 15, fontWeight: '600' },
  modal: { flex: 1, paddingHorizontal: 20, paddingBottom: 20 },
  modalHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  headerAction: {
    width: 72,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerActionText: { fontSize: 15, fontWeight: '700' },
  disabledText: { opacity: 0.35 },
  calendar: { padding: 14, overflow: 'hidden' },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: { fontSize: 18, fontWeight: '800' },
  weekdayRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  daySlot: {
    width: '14.2857%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15, fontWeight: '500' },
  endpointText: { fontWeight: '800' },
  hint: { marginTop: 16, textAlign: 'center', fontSize: 13, fontWeight: '600' },
})
