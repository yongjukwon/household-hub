import { assertEquals } from 'jsr:@std/assert@1'

import {
  candidateWindow,
  dueReminders,
  occurrenceStartOf,
  reminderAnchorOf,
  reminderPushCopy,
  type ReminderCandidate,
} from './reminders.ts'

const timedEvent = (
  overrides: Partial<ReminderCandidate> = {},
): ReminderCandidate => ({
  householdId: 'household-1',
  eventId: 'event-1',
  title: 'Dentist',
  allDay: false,
  startAt: '2026-07-15T14:00:00.000Z',
  startDate: null,
  eventTimezone: 'America/Toronto',
  presets: ['1h'],
  dispatched: [],
  ...overrides,
})

const allDayEvent = (
  overrides: Partial<ReminderCandidate> = {},
): ReminderCandidate => ({
  householdId: 'household-1',
  eventId: 'event-2',
  title: 'Anniversary',
  allDay: true,
  startAt: null,
  startDate: '2026-07-15',
  eventTimezone: 'America/Toronto',
  presets: ['at-time'],
  dispatched: [],
  ...overrides,
})

Deno.test('all-day reminders anchor to 09:00 in the event timezone', () => {
  const candidate = allDayEvent()
  // Toronto is UTC-4 in July: local midnight is 04:00Z, 09:00 local is 13:00Z.
  assertEquals(
    occurrenceStartOf(candidate).toISOString(),
    '2026-07-15T04:00:00.000Z',
  )
  assertEquals(
    reminderAnchorOf(candidate).toISOString(),
    '2026-07-15T13:00:00.000Z',
  )
})

Deno.test('timed reminders anchor to the stored instant', () => {
  const candidate = timedEvent()
  assertEquals(
    occurrenceStartOf(candidate).toISOString(),
    '2026-07-15T14:00:00.000Z',
  )
  assertEquals(
    reminderAnchorOf(candidate).toISOString(),
    '2026-07-15T14:00:00.000Z',
  )
})

Deno.test('a reminder is due once its lead time is reached', () => {
  const candidate = timedEvent({ presets: ['1h'] })

  assertEquals(
    dueReminders([candidate], { now: new Date('2026-07-15T12:59:00Z') }).length,
    0,
  )

  const due = dueReminders([candidate], {
    now: new Date('2026-07-15T13:00:00Z'),
  })
  assertEquals(due.length, 1)
  assertEquals(due[0].preset, '1h')
  assertEquals(due[0].fireAt.toISOString(), '2026-07-15T13:00:00.000Z')
  assertEquals(due[0].occurrenceStart.toISOString(), '2026-07-15T14:00:00.000Z')
})

Deno.test('the "none" preset never fires', () => {
  const due = dueReminders([timedEvent({ presets: ['none'] })], {
    now: new Date('2026-07-15T14:00:00Z'),
  })
  assertEquals(due, [])
})

Deno.test('unknown presets are ignored rather than throwing', () => {
  const due = dueReminders([timedEvent({ presets: ['1mo'] })], {
    now: new Date('2026-07-15T14:00:00Z'),
  })
  assertEquals(due, [])
})

Deno.test(
  'multiple presets on one event each fire on their own schedule',
  () => {
    const candidate = timedEvent({ presets: ['10m', '1h', '1d'] })

    const atDayBefore = dueReminders([candidate], {
      now: new Date('2026-07-14T14:00:00Z'),
    })
    assertEquals(
      atDayBefore.map((entry) => entry.preset),
      ['1d'],
    )

    const atStart = dueReminders([candidate], {
      now: new Date('2026-07-15T14:00:00Z'),
      graceMinutes: 24 * 60,
    })
    assertEquals(
      atStart.map((entry) => entry.preset),
      ['1d', '1h', '10m'],
    )
  },
)

Deno.test('an already dispatched (preset, occurrence) pair is skipped', () => {
  const candidate = timedEvent({
    presets: ['1h'],
    dispatched: [
      { preset: '1h', occurrenceStart: '2026-07-15T14:00:00+00:00' },
    ],
  })
  assertEquals(
    dueReminders([candidate], { now: new Date('2026-07-15T13:30:00Z') }),
    [],
  )
})

Deno.test('re-timing an event re-fires its reminder', () => {
  // The dispatch recorded against the old start no longer matches the new one.
  const candidate = timedEvent({
    presets: ['1h'],
    startAt: '2026-07-15T16:00:00.000Z',
    dispatched: [
      { preset: '1h', occurrenceStart: '2026-07-15T14:00:00+00:00' },
    ],
  })
  const due = dueReminders([candidate], {
    now: new Date('2026-07-15T15:00:00Z'),
  })
  assertEquals(due.length, 1)
  assertEquals(due[0].occurrenceStart.toISOString(), '2026-07-15T16:00:00.000Z')
})

Deno.test(
  'a reminder older than the grace window is dropped, not sent late',
  () => {
    const candidate = timedEvent({ presets: ['at-time'] })
    assertEquals(
      dueReminders([candidate], {
        now: new Date('2026-07-15T14:59:00Z'),
        graceMinutes: 60,
      }).length,
      1,
    )
    assertEquals(
      dueReminders([candidate], {
        now: new Date('2026-07-15T15:01:00Z'),
        graceMinutes: 60,
      }).length,
      0,
    )
  },
)

Deno.test(
  'an all-day reminder one day out fires at 09:00 the previous day',
  () => {
    const candidate = allDayEvent({ presets: ['1d'] })
    const due = dueReminders([candidate], {
      now: new Date('2026-07-14T13:00:00Z'),
    })
    assertEquals(due.length, 1)
    assertEquals(due[0].fireAt.toISOString(), '2026-07-14T13:00:00.000Z')
    // The dispatch key stays the event's own start, not the 09:00 anchor.
    assertEquals(
      due[0].occurrenceStart.toISOString(),
      '2026-07-15T04:00:00.000Z',
    )
  },
)

Deno.test(
  'all-day anchors follow daylight saving in the event timezone',
  () => {
    const winter = allDayEvent({ startDate: '2026-01-15' })
    assertEquals(
      reminderAnchorOf(winter).toISOString(),
      '2026-01-15T14:00:00.000Z',
    )
  },
)

Deno.test('events without presets produce nothing', () => {
  assertEquals(
    dueReminders([timedEvent({ presets: null }), timedEvent({ presets: [] })], {
      now: new Date('2026-07-15T14:00:00Z'),
    }),
    [],
  )
})

Deno.test('duplicate presets collapse to a single reminder', () => {
  const due = dueReminders([timedEvent({ presets: ['1h', '1h'] })], {
    now: new Date('2026-07-15T13:30:00Z'),
  })
  assertEquals(due.length, 1)
})

Deno.test(
  'the candidate window spans the longest lead and the grace window',
  () => {
    const now = new Date('2026-07-15T12:00:00Z')
    const { windowStart, windowEnd } = candidateWindow(now, 60)
    assertEquals(windowStart.toISOString(), '2026-07-15T11:00:00.000Z')
    // One week (longest preset) plus a day of all-day anchor slack.
    assertEquals(windowEnd.toISOString(), '2026-07-23T12:00:00.000Z')
  },
)

Deno.test('push copy reports the local start time of a timed event', () => {
  const candidate = timedEvent({ presets: ['1h'] })
  const [reminder] = dueReminders([candidate], {
    now: new Date('2026-07-15T13:00:00Z'),
  })
  assertEquals(reminderPushCopy(reminder, candidate), {
    title: 'Dentist',
    body: 'In 1 hour (10:00)',
  })
})

Deno.test('push copy for an all-day event omits a clock time', () => {
  const candidate = allDayEvent({ presets: ['at-time'] })
  const [reminder] = dueReminders([candidate], {
    now: new Date('2026-07-15T13:00:00Z'),
  })
  assertEquals(reminderPushCopy(reminder, candidate), {
    title: 'Anniversary',
    body: 'Today',
  })
})
