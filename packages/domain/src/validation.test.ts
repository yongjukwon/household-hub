import { describe, expect, it } from 'vitest'
import {
  isCents,
  isCurrencyCode,
  isIsoDateTime,
  isPositiveCents,
  isRevision,
  isTimeZone,
  isUuid,
} from './index'

describe('domain scalar validation', () => {
  it('accepts canonical UUIDs and rejects malformed identifiers', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('550e8400-e29b-01d4-a716-446655440000')).toBe(false)
  })

  it('keeps cents as signed safe integers and positive cents above zero', () => {
    expect(isCents(-1)).toBe(true)
    expect(isCents(0)).toBe(true)
    expect(isCents(Number.MAX_SAFE_INTEGER + 1)).toBe(false)
    expect(isPositiveCents(1)).toBe(true)
    expect(isPositiveCents(0)).toBe(false)
  })

  it('requires uppercase three-letter currency codes', () => {
    expect(isCurrencyCode('CAD')).toBe(true)
    expect(isCurrencyCode('cad')).toBe(false)
    expect(isCurrencyCode('US')).toBe(false)
  })

  it('validates IANA zones through Intl and revisions from one', () => {
    expect(isTimeZone('America/Vancouver')).toBe(true)
    expect(isTimeZone('Not/A_Zone')).toBe(false)
    expect(isRevision(1)).toBe(true)
    expect(isRevision(0)).toBe(false)
    expect(isRevision(1.5)).toBe(false)
  })

  it('rejects impossible ISO calendar dates', () => {
    expect(isIsoDateTime('2026-02-30T12:00:00.000Z')).toBe(false)
  })
})
