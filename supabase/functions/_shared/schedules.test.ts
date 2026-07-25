import { assertEquals, assertThrows } from 'jsr:@std/assert@1'

import {
  dueOccurrences,
  isTransferFrequency,
  MAX_OCCURRENCES_PER_RUN,
  type TransferSchedule,
} from './schedules.ts'

const schedule = (
  overrides: Partial<TransferSchedule> = {},
): TransferSchedule => ({
  scheduleId: 'schedule-1',
  householdId: 'household-1',
  fromAssetId: 'asset-1',
  toAssetId: 'asset-2',
  amountCents: 25_000,
  frequency: 'weekly',
  // 08:00 Toronto time.
  startsAt: '2026-07-01T12:00:00.000Z',
  timezone: 'America/Toronto',
  lastOccurrenceDate: null,
  ...overrides,
})

const dates = (occurrences: { occurrenceDate: string }[]) =>
  occurrences.map((occurrence) => occurrence.occurrenceDate)

Deno.test(
  'isTransferFrequency accepts only the four supported frequencies',
  () => {
    assertEquals(isTransferFrequency('weekly'), true)
    assertEquals(isTransferFrequency('biweekly'), true)
    assertEquals(isTransferFrequency('semi_monthly'), true)
    assertEquals(isTransferFrequency('monthly'), true)
    assertEquals(isTransferFrequency('daily'), false)
  },
)

Deno.test(
  'an unsupported frequency is rejected rather than silently skipped',
  () => {
    assertThrows(() =>
      dueOccurrences(
        schedule({ frequency: 'daily' }),
        new Date('2026-07-30T12:00:00Z'),
      ),
    )
  },
)

Deno.test('weekly occurrences run every seven days from the anchor', () => {
  assertEquals(
    dates(dueOccurrences(schedule(), new Date('2026-07-23T12:00:00Z'))),
    ['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22'],
  )
})

Deno.test('an occurrence is not owed until its local time arrives', () => {
  // 2026-07-08 08:00 Toronto is 12:00Z.
  assertEquals(
    dates(dueOccurrences(schedule(), new Date('2026-07-08T11:59:00Z'))),
    ['2026-07-01'],
  )
  assertEquals(
    dates(dueOccurrences(schedule(), new Date('2026-07-08T12:00:00Z'))),
    ['2026-07-01', '2026-07-08'],
  )
})

Deno.test('occurrences already executed are not repeated', () => {
  assertEquals(
    dates(
      dueOccurrences(
        schedule({ lastOccurrenceDate: '2026-07-08' }),
        new Date('2026-07-23T12:00:00Z'),
      ),
    ),
    ['2026-07-15', '2026-07-22'],
  )
})

Deno.test('a fully caught-up schedule owes nothing', () => {
  assertEquals(
    dueOccurrences(
      schedule({ lastOccurrenceDate: '2026-07-22' }),
      new Date('2026-07-23T12:00:00Z'),
    ),
    [],
  )
})

Deno.test('biweekly occurrences run every fourteen days', () => {
  assertEquals(
    dates(
      dueOccurrences(
        schedule({ frequency: 'biweekly' }),
        new Date('2026-08-15T12:00:00Z'),
      ),
    ),
    ['2026-07-01', '2026-07-15', '2026-07-29', '2026-08-12'],
  )
})

Deno.test('monthly occurrences keep the anchor day of month', () => {
  assertEquals(
    dates(
      dueOccurrences(
        schedule({
          frequency: 'monthly',
          startsAt: '2026-01-15T13:00:00.000Z',
        }),
        new Date('2026-04-20T12:00:00Z'),
      ),
    ),
    ['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15'],
  )
})

Deno.test(
  'a monthly anchor on the 31st clamps without dragging later months',
  () => {
    assertEquals(
      dates(
        dueOccurrences(
          schedule({
            frequency: 'monthly',
            startsAt: '2026-01-31T13:00:00.000Z',
          }),
          new Date('2026-05-01T12:00:00Z'),
        ),
      ),
      ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
    )
  },
)

Deno.test(
  'semi-monthly pairs the anchor day with one fifteen days away',
  () => {
    assertEquals(
      dates(
        dueOccurrences(
          schedule({
            frequency: 'semi_monthly',
            startsAt: '2026-01-05T13:00:00.000Z',
          }),
          new Date('2026-02-25T12:00:00Z'),
        ),
      ),
      ['2026-01-05', '2026-01-20', '2026-02-05', '2026-02-20'],
    )
  },
)

Deno.test('a semi-monthly anchor after the 15th starts mid-month', () => {
  // Anchor on the 20th pairs with the 5th; the 5th of the anchor month is
  // before the schedule started, so it is skipped.
  assertEquals(
    dates(
      dueOccurrences(
        schedule({
          frequency: 'semi_monthly',
          startsAt: '2026-01-20T13:00:00.000Z',
        }),
        new Date('2026-02-25T12:00:00Z'),
      ),
    ),
    ['2026-01-20', '2026-02-05', '2026-02-20'],
  )
})

Deno.test('semi-monthly clamps the second day in February', () => {
  assertEquals(
    dates(
      dueOccurrences(
        schedule({
          frequency: 'semi_monthly',
          startsAt: '2026-02-16T13:00:00.000Z',
        }),
        new Date('2026-03-10T12:00:00Z'),
      ),
    ),
    // Anchor day 16 → pair days 1 and 16; February 1 precedes the anchor.
    ['2026-02-16', '2026-03-01'],
  )
})

Deno.test(
  'occurrences keep their wall-clock time across daylight saving',
  () => {
    const occurrences = dueOccurrences(
      schedule({ startsAt: '2026-02-25T13:00:00.000Z' }),
      new Date('2026-03-20T13:00:00Z'),
    )
    // 08:00 Toronto is 13:00Z in winter and 12:00Z after the March 8 transition.
    assertEquals(
      occurrences[0].occurredAt.toISOString(),
      '2026-02-25T13:00:00.000Z',
    )
    assertEquals(
      occurrences[2].occurredAt.toISOString(),
      '2026-03-11T12:00:00.000Z',
    )
  },
)

Deno.test('a long outage catches up in bounded batches', () => {
  const occurrences = dueOccurrences(
    schedule({ startsAt: '2020-01-01T13:00:00.000Z' }),
    new Date('2026-07-23T12:00:00Z'),
  )
  assertEquals(occurrences.length, MAX_OCCURRENCES_PER_RUN)
  assertEquals(occurrences[0].occurrenceDate, '2020-01-01')
})

Deno.test(
  'the timezone is the schedule timezone, not the runtime timezone',
  () => {
    const occurrences = dueOccurrences(
      schedule({
        startsAt: '2026-07-01T23:30:00.000Z',
        timezone: 'Asia/Seoul',
      }),
      new Date('2026-07-10T12:00:00Z'),
    )
    // 23:30Z is 08:30 on July 2 in Seoul.
    assertEquals(dates(occurrences), ['2026-07-02', '2026-07-09'])
    assertEquals(
      occurrences[1].occurredAt.toISOString(),
      '2026-07-08T23:30:00.000Z',
    )
  },
)
