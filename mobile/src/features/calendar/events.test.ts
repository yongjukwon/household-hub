import {
  eventDatesInRange,
  eventOccursOn,
  type CalendarEventItem,
} from '@/features/calendar/events'

function makeEvent(overrides: Partial<CalendarEventItem>): CalendarEventItem {
  return {
    id: 'e1',
    title: 'Event',
    note: null,
    ownerId: null,
    allDay: false,
    timeZone: 'America/Toronto',
    startsAt: null,
    endsAt: null,
    startDate: null,
    endDate: null,
    recurrenceFrequency: 'none',
    recurrenceUntil: null,
    reminders: [],
    revision: 1,
    ...overrides,
  }
}

describe('eventDatesInRange — timed, device timezone', () => {
  it('places a timed event on its device-timezone civil date', () => {
    // 2026-07-11T01:00Z is still 2026-07-10 in Toronto (UTC-4).
    const event = makeEvent({
      allDay: false,
      startsAt: '2026-07-11T01:00:00Z',
      endsAt: '2026-07-11T02:00:00Z',
    })
    expect(eventOccursOn(event, '2026-07-10', 'America/Toronto')).toBe(true)
    expect(eventOccursOn(event, '2026-07-11', 'America/Toronto')).toBe(false)
    // Same instant viewed from UTC lands on the 11th.
    expect(eventOccursOn(event, '2026-07-11', 'UTC')).toBe(true)
  })
})

describe('eventDatesInRange — all-day / multiday', () => {
  it('covers every date in a multiday span, inclusive', () => {
    const event = makeEvent({
      allDay: true,
      startDate: '2026-07-10',
      endDate: '2026-07-12',
    })
    expect(
      eventDatesInRange(event, '2026-07-01', '2026-07-31', 'UTC'),
    ).toEqual(['2026-07-10', '2026-07-11', '2026-07-12'])
  })
})

describe('eventDatesInRange — recurrence', () => {
  it('expands a weekly event within the range', () => {
    const event = makeEvent({
      allDay: true,
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      recurrenceFrequency: 'weekly',
    })
    expect(
      eventDatesInRange(event, '2026-07-01', '2026-07-31', 'UTC'),
    ).toEqual(['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22', '2026-07-29'])
  })

  it('honors recurrenceUntil (inclusive)', () => {
    const event = makeEvent({
      allDay: true,
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      recurrenceFrequency: 'weekly',
      recurrenceUntil: '2026-07-15',
    })
    expect(
      eventDatesInRange(event, '2026-07-01', '2026-07-31', 'UTC'),
    ).toEqual(['2026-07-01', '2026-07-08', '2026-07-15'])
  })

  it('skips months without the anchor day-of-month for monthly recurrence', () => {
    const event = makeEvent({
      allDay: true,
      startDate: '2026-01-31',
      endDate: '2026-01-31',
      recurrenceFrequency: 'monthly',
    })
    // February has no 31st, so no February occurrence.
    expect(eventOccursOn(event, '2026-02-28', 'UTC')).toBe(false)
    expect(eventOccursOn(event, '2026-03-31', 'UTC')).toBe(true)
  })

  it('does not expand a non-recurring event beyond its span', () => {
    const event = makeEvent({
      allDay: true,
      startDate: '2026-07-10',
      endDate: '2026-07-10',
      recurrenceFrequency: 'none',
    })
    expect(
      eventDatesInRange(event, '2026-07-01', '2026-07-31', 'UTC'),
    ).toEqual(['2026-07-10'])
  })
})
