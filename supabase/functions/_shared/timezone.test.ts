import { assertEquals, assertThrows } from 'jsr:@std/assert@1'

import {
  addDays,
  addMonthsClamped,
  daysInMonth,
  instantToZonedParts,
  timeZoneOffsetMinutes,
  withDayOfMonthClamped,
  zonedDateTimeToInstant,
} from './timezone.ts'

Deno.test('timeZoneOffsetMinutes reports zero for UTC', () => {
  assertEquals(
    timeZoneOffsetMinutes('UTC', new Date('2026-07-01T00:00:00Z')),
    0,
  )
})

Deno.test('timeZoneOffsetMinutes follows daylight saving', () => {
  assertEquals(
    timeZoneOffsetMinutes('America/Toronto', new Date('2026-01-15T12:00:00Z')),
    -300,
  )
  assertEquals(
    timeZoneOffsetMinutes('America/Toronto', new Date('2026-07-15T12:00:00Z')),
    -240,
  )
})

Deno.test('timeZoneOffsetMinutes handles half-hour and fixed zones', () => {
  assertEquals(
    timeZoneOffsetMinutes('Asia/Kolkata', new Date('2026-07-15T12:00:00Z')),
    330,
  )
  assertEquals(
    timeZoneOffsetMinutes('Asia/Seoul', new Date('2026-01-15T12:00:00Z')),
    540,
  )
  assertEquals(
    timeZoneOffsetMinutes('Asia/Seoul', new Date('2026-07-15T12:00:00Z')),
    540,
  )
})

Deno.test('timeZoneOffsetMinutes rejects an unknown zone', () => {
  assertThrows(() =>
    timeZoneOffsetMinutes('Mars/Olympus', new Date('2026-07-15T12:00:00Z')),
  )
})

Deno.test('zonedDateTimeToInstant resolves 09:00 across a DST boundary', () => {
  // 09:00 in Toronto is 14:00Z in summer and 13:00Z during standard time.
  assertEquals(
    zonedDateTimeToInstant(
      '2026-07-15',
      9 * 60,
      'America/Toronto',
    ).toISOString(),
    '2026-07-15T13:00:00.000Z',
  )
  assertEquals(
    zonedDateTimeToInstant(
      '2026-01-15',
      9 * 60,
      'America/Toronto',
    ).toISOString(),
    '2026-01-15T14:00:00.000Z',
  )
})

Deno.test(
  'zonedDateTimeToInstant handles the spring-forward transition',
  () => {
    // Toronto springs forward at 02:00 local on 2026-03-08; 02:30 never happens,
    // so the result must land on the instant the clock jumped to (03:00 local).
    assertEquals(
      zonedDateTimeToInstant(
        '2026-03-08',
        2 * 60 + 30,
        'America/Toronto',
      ).toISOString(),
      '2026-03-08T07:00:00.000Z',
    )
    // 09:00 the same day is already on the summer offset.
    assertEquals(
      zonedDateTimeToInstant(
        '2026-03-08',
        9 * 60,
        'America/Toronto',
      ).toISOString(),
      '2026-03-08T13:00:00.000Z',
    )
  },
)

Deno.test('zonedDateTimeToInstant handles the fall-back transition', () => {
  // Toronto falls back at 02:00 local on 2026-11-01. 01:30 occurs twice; the
  // first (still-daylight) instant is the one used.
  assertEquals(
    zonedDateTimeToInstant(
      '2026-11-01',
      60 + 30,
      'America/Toronto',
    ).toISOString(),
    '2026-11-01T05:30:00.000Z',
  )
})

Deno.test(
  'zonedDateTimeToInstant round-trips through instantToZonedParts',
  () => {
    for (const zone of [
      'UTC',
      'America/Toronto',
      'Asia/Seoul',
      'Europe/London',
    ]) {
      for (const date of ['2026-01-15', '2026-07-15', '2026-11-01']) {
        const instant = zonedDateTimeToInstant(date, 9 * 60, zone)
        assertEquals(instantToZonedParts(instant, zone), {
          date,
          minutesOfDay: 9 * 60,
        })
      }
    }
  },
)

Deno.test('instantToZonedParts reads local wall time, not UTC', () => {
  assertEquals(
    instantToZonedParts(new Date('2026-07-15T02:30:00Z'), 'America/Toronto'),
    { date: '2026-07-14', minutesOfDay: 22 * 60 + 30 },
  )
  assertEquals(
    instantToZonedParts(new Date('2026-07-15T23:30:00Z'), 'Asia/Seoul'),
    { date: '2026-07-16', minutesOfDay: 8 * 60 + 30 },
  )
})

Deno.test('instantToZonedParts uses a 24-hour clock at midnight', () => {
  assertEquals(instantToZonedParts(new Date('2026-07-15T00:00:00Z'), 'UTC'), {
    date: '2026-07-15',
    minutesOfDay: 0,
  })
})

Deno.test('daysInMonth covers leap years', () => {
  assertEquals(daysInMonth(2026, 2), 28)
  assertEquals(daysInMonth(2028, 2), 29)
  assertEquals(daysInMonth(2026, 4), 30)
  assertEquals(daysInMonth(2026, 12), 31)
})

Deno.test('addDays crosses month and year boundaries', () => {
  assertEquals(addDays('2026-01-30', 7), '2026-02-06')
  assertEquals(addDays('2026-12-28', 14), '2027-01-11')
  assertEquals(addDays('2026-03-01', -1), '2026-02-28')
})

Deno.test('addMonthsClamped clamps to the shorter target month', () => {
  assertEquals(addMonthsClamped('2026-01-31', 1), '2026-02-28')
  assertEquals(addMonthsClamped('2026-01-31', 3), '2026-04-30')
  assertEquals(addMonthsClamped('2026-05-15', 1), '2026-06-15')
  assertEquals(addMonthsClamped('2026-11-30', 2), '2027-01-30')
  assertEquals(addMonthsClamped('2028-01-31', 1), '2028-02-29')
})

Deno.test('withDayOfMonthClamped never overflows the month', () => {
  assertEquals(withDayOfMonthClamped('2026-02-05', 20), '2026-02-20')
  assertEquals(withDayOfMonthClamped('2026-02-05', 31), '2026-02-28')
  assertEquals(withDayOfMonthClamped('2026-04-10', 31), '2026-04-30')
})
