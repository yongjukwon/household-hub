import { describe, expect, it } from 'vitest'
import {
  utcToZonedWall,
  zonedWallToUtc,
} from '@/features/calendar/datetime'
import { buildEventPayload } from '@/features/calendar/mutations'

describe('zonedWallToUtc', () => {
  it('converts a Toronto summer wall time (UTC-4) to UTC', () => {
    // 2026-07-11 14:30 EDT === 18:30 UTC.
    expect(zonedWallToUtc('2026-07-11T14:30', 'America/Toronto')).toBe(
      '2026-07-11T18:30:00.000Z',
    )
  })

  it('converts a winter wall time (UTC-5) to UTC', () => {
    // 2026-01-11 14:30 EST === 19:30 UTC.
    expect(zonedWallToUtc('2026-01-11T14:30', 'America/Toronto')).toBe(
      '2026-01-11T19:30:00.000Z',
    )
  })

  it('round-trips through utcToZonedWall', () => {
    const wall = '2026-07-11T14:30'
    const utc = zonedWallToUtc(wall, 'America/Toronto')
    expect(utcToZonedWall(utc, 'America/Toronto')).toBe(wall)
  })
})

describe('buildEventPayload', () => {
  it('keeps timed fields and omits all-day fields for a timed event', () => {
    const payload = buildEventPayload({
      id: 'e1',
      ownerId: null,
      title: '  Dentist  ',
      note: '  bring card  ',
      allDay: false,
      startAt: '2026-07-11T18:30:00.000Z',
      endAt: '2026-07-11T19:30:00.000Z',
      startDate: null,
      endDate: null,
      timezone: 'America/Toronto',
      recurrenceFrequency: 'none',
      recurrenceUntil: '2026-12-31',
      reminders: ['1h'],
    })
    expect(payload).toMatchObject({
      title: 'Dentist',
      note: 'bring card',
      allDay: false,
      startAt: '2026-07-11T18:30:00.000Z',
      endAt: '2026-07-11T19:30:00.000Z',
      // recurrenceUntil is dropped when frequency is none
      recurrenceUntil: null,
      reminders: ['1h'],
    })
    expect(payload).not.toHaveProperty('startDate')
    expect(payload).not.toHaveProperty('endDate')
  })

  it('keeps all-day fields and omits timed fields for an all-day event', () => {
    const payload = buildEventPayload({
      id: 'e2',
      ownerId: null,
      title: 'Trip',
      note: null,
      allDay: true,
      startAt: '2026-07-11T18:30:00.000Z',
      endAt: '2026-07-11T19:30:00.000Z',
      startDate: '2026-07-11',
      endDate: '2026-07-13',
      timezone: 'America/Toronto',
      recurrenceFrequency: 'weekly',
      recurrenceUntil: '2026-09-01',
      reminders: [],
    })
    expect(payload).toMatchObject({
      allDay: true,
      startDate: '2026-07-11',
      endDate: '2026-07-13',
      recurrenceUntil: '2026-09-01',
      note: null,
    })
    expect(payload).not.toHaveProperty('startAt')
    expect(payload).not.toHaveProperty('endAt')
  })
})
