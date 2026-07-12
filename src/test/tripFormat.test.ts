import { describe, expect, it } from 'vitest'
import {
  daysInRange,
  formatDateRange,
  normalizeUrl,
} from '@/components/trips/trip-format'

describe('daysInRange', () => {
  it('lists each day from start to end inclusive', () => {
    expect(daysInRange('2026-08-01', '2026-08-04')).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
    ])
  })

  it('spans month boundaries', () => {
    expect(daysInRange('2026-07-30', '2026-08-02')).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ])
  })

  it('returns [] for a missing bound or inverted range', () => {
    expect(daysInRange(null, '2026-08-04')).toEqual([])
    expect(daysInRange('2026-08-04', null)).toEqual([])
    expect(daysInRange('2026-08-04', '2026-08-01')).toEqual([])
  })
})

describe('formatDateRange', () => {
  it('returns null unless both bounds are set', () => {
    expect(formatDateRange(null, '2026-08-04')).toBeNull()
    expect(formatDateRange('2026-08-01', null)).toBeNull()
  })

  it('formats a range with weekdays when both are set', () => {
    // 2026-08-01 is a Saturday, 2026-08-07 a Friday.
    expect(formatDateRange('2026-08-01', '2026-08-07')).toMatch(
      /Sat, Aug 1.*Fri, Aug 7/,
    )
  })
})

describe('normalizeUrl', () => {
  it('treats blank/whitespace as null (cleared link)', () => {
    expect(normalizeUrl('')).toBeNull()
    expect(normalizeUrl('   ')).toBeNull()
  })

  it('prefixes https:// when no scheme is present', () => {
    expect(normalizeUrl('example.com/tickets')).toBe(
      'https://example.com/tickets',
    )
  })

  it('keeps an existing http/https scheme', () => {
    expect(normalizeUrl('http://maps.example/x')).toBe('http://maps.example/x')
    expect(normalizeUrl('https://air.example/pnr')).toBe(
      'https://air.example/pnr',
    )
  })

  it('rejects non-http(s) schemes and unparseable input as undefined', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeUndefined()
    expect(normalizeUrl('mailto:a@b.com')).toBeUndefined()
    expect(normalizeUrl('http://')).toBeUndefined()
  })
})
