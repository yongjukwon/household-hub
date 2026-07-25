import { describe, it, expect } from 'vitest'
import {
  buildOwnerColors,
  expandOccurrences,
  type CalendarEvent,
} from '@/lib/calendar'

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: overrides.id ?? 'e1',
    household_id: 'h1',
    owner_id: null,
    created_by: 'u1',
    title: 'Event',
    note: null,
    all_day: false,
    start_at: '2026-07-01T12:00:00.000Z',
    end_at: '2026-07-01T13:00:00.000Z',
    recurrence_freq: 'none',
    recurrence_until: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    start_date: null,
    end_date: null,
    event_timezone: 'America/Toronto',
    revision: 1,
    ...overrides,
  }
}

const rangeStart = new Date('2026-07-01T00:00:00.000Z')
const rangeEndWeek = new Date('2026-07-07T23:59:59.999Z')
const rangeEndMonth = new Date('2026-07-31T23:59:59.999Z')

describe('expandOccurrences', () => {
  it('returns a single occurrence for a non-recurring event in range', () => {
    const occ = expandOccurrences([makeEvent()], rangeStart, rangeEndWeek)
    expect(occ).toHaveLength(1)
    expect(occ[0].start.toISOString()).toBe('2026-07-01T12:00:00.000Z')
  })

  it('excludes a non-recurring event outside the range', () => {
    const event = makeEvent({
      start_at: '2026-09-01T12:00:00.000Z',
      end_at: '2026-09-01T13:00:00.000Z',
    })
    expect(expandOccurrences([event], rangeStart, rangeEndWeek)).toHaveLength(0)
  })

  it('includes a multi-day event that overlaps the range start', () => {
    const event = makeEvent({
      start_at: '2026-06-29T12:00:00.000Z',
      end_at: '2026-07-02T12:00:00.000Z',
    })
    expect(expandOccurrences([event], rangeStart, rangeEndWeek)).toHaveLength(1)
  })

  it('expands a daily event across the visible week', () => {
    const event = makeEvent({ recurrence_freq: 'daily' })
    expect(expandOccurrences([event], rangeStart, rangeEndWeek)).toHaveLength(7)
  })

  it('expands a weekly event across the visible month', () => {
    const event = makeEvent({ recurrence_freq: 'weekly' })
    // Jul 1, 8, 15, 22, 29
    expect(expandOccurrences([event], rangeStart, rangeEndMonth)).toHaveLength(
      5,
    )
  })

  it('expands a monthly event to one occurrence in the month', () => {
    const event = makeEvent({
      start_at: '2026-01-15T12:00:00.000Z',
      end_at: '2026-01-15T13:00:00.000Z',
      recurrence_freq: 'monthly',
    })
    const occ = expandOccurrences([event], rangeStart, rangeEndMonth)
    expect(occ).toHaveLength(1)
    expect(occ[0].start.getUTCMonth()).toBe(6) // July
    expect(occ[0].start.getUTCDate()).toBe(15)
  })

  it('expands a yearly event to one occurrence in the month', () => {
    const event = makeEvent({
      start_at: '2020-07-04T12:00:00.000Z',
      end_at: '2020-07-04T13:00:00.000Z',
      recurrence_freq: 'yearly',
    })
    const occ = expandOccurrences([event], rangeStart, rangeEndMonth)
    expect(occ).toHaveLength(1)
    expect(occ[0].start.getUTCFullYear()).toBe(2026)
  })

  it('stops a recurring series at recurrence_until (inclusive)', () => {
    const event = makeEvent({
      recurrence_freq: 'daily',
      recurrence_until: '2026-07-03',
    })
    // Jul 1, 2, 3 only
    expect(expandOccurrences([event], rangeStart, rangeEndWeek)).toHaveLength(3)
  })

  it('preserves each occurrence duration', () => {
    const event = makeEvent({
      start_at: '2026-07-01T09:00:00.000Z',
      end_at: '2026-07-01T11:00:00.000Z', // 2h
      recurrence_freq: 'daily',
    })
    const occ = expandOccurrences([event], rangeStart, rangeEndWeek)
    for (const o of occ) {
      expect(o.end.getTime() - o.start.getTime()).toBe(2 * 60 * 60 * 1000)
    }
  })

  it('fast-forwards a long-past daily series without hitting the cap', () => {
    const event = makeEvent({
      start_at: '2015-01-01T12:00:00.000Z',
      end_at: '2015-01-01T13:00:00.000Z',
      recurrence_freq: 'daily',
    })
    expect(expandOccurrences([event], rangeStart, rangeEndWeek)).toHaveLength(7)
  })

  it('sorts occurrences from multiple events by start', () => {
    const a = makeEvent({
      id: 'a',
      start_at: '2026-07-03T09:00:00.000Z',
      end_at: '2026-07-03T10:00:00.000Z',
    })
    const b = makeEvent({
      id: 'b',
      start_at: '2026-07-01T09:00:00.000Z',
      end_at: '2026-07-01T10:00:00.000Z',
    })
    const occ = expandOccurrences([a, b], rangeStart, rangeEndWeek)
    expect(occ.map((o) => o.event.id)).toEqual(['b', 'a'])
  })
})

describe('buildOwnerColors', () => {
  const members = [
    { userId: 'bbb', displayName: 'Rabbit' },
    { userId: 'aaa', displayName: 'Penguin' },
  ]

  it('maps null owner to the shared color and label', () => {
    const oc = buildOwnerColors(members, 'aaa')
    expect(oc.labelFor(null)).toBe('Shared')
    // Shared color differs from both member colors.
    expect(oc.colorFor(null)).not.toBe(oc.colorFor('aaa'))
    expect(oc.colorFor(null)).not.toBe(oc.colorFor('bbb'))
  })

  it('assigns distinct, stable colors to the two members', () => {
    const oc1 = buildOwnerColors(members, 'aaa')
    const oc2 = buildOwnerColors([...members].reverse(), 'aaa')
    expect(oc1.colorFor('aaa')).not.toBe(oc1.colorFor('bbb'))
    // Stable regardless of input order (sorted by userId).
    expect(oc2.colorFor('aaa')).toBe(oc1.colorFor('aaa'))
    expect(oc2.colorFor('bbb')).toBe(oc1.colorFor('bbb'))
  })

  it('labels the current user "You" and the partner by name', () => {
    const oc = buildOwnerColors(members, 'aaa')
    expect(oc.labelFor('aaa')).toBe('You')
    expect(oc.labelFor('bbb')).toBe('Rabbit')
  })

  it('legend lists both members then Shared', () => {
    const oc = buildOwnerColors(members, 'aaa')
    expect(oc.legend.map((l) => l.label)).toEqual(['You', 'Rabbit', 'Shared'])
  })
})
