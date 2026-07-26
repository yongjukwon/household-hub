
import {
  buildEventPayload,
  type CalendarEventForm,
} from '@/features/calendar/mutations'

function eventForm(overrides: Partial<CalendarEventForm>): CalendarEventForm {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: null,
    title: 'Dinner',
    note: null,
    allDay: false,
    startAt: '2026-07-25T19:00:00.000Z',
    endAt: '2026-07-25T20:00:00.000Z',
    startDate: null,
    endDate: null,
    timezone: 'America/Vancouver',
    recurrenceFrequency: 'none',
    recurrenceUntil: null,
    reminders: [],
    ...overrides,
  }
}

describe('buildEventPayload', () => {
  it('omits all-day date keys for a timed event', () => {
    const payload = buildEventPayload(eventForm({}))

    expect(payload).toMatchObject({
      allDay: false,
      startAt: '2026-07-25T19:00:00.000Z',
      endAt: '2026-07-25T20:00:00.000Z',
    })
    expect(payload).not.toHaveProperty('startDate')
    expect(payload).not.toHaveProperty('endDate')
  })

  it('omits timed instant keys for an all-day event', () => {
    const payload = buildEventPayload(
      eventForm({
        allDay: true,
        startAt: null,
        endAt: null,
        startDate: '2026-07-25',
        endDate: '2026-07-26',
      }),
    )

    expect(payload).toMatchObject({
      allDay: true,
      startDate: '2026-07-25',
      endDate: '2026-07-26',
    })
    expect(payload).not.toHaveProperty('startAt')
    expect(payload).not.toHaveProperty('endAt')
  })

  it('uses database reminder values and omits the none sentinel', () => {
    const payload = buildEventPayload(
      eventForm({ reminders: ['at-time', '10m', 'none'] }),
    )

    expect(payload.reminders).toEqual(['at_time', '10m'])
  })
})
