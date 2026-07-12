import { describe, expect, it } from 'vitest'
import { normalizeUrl } from '@/components/trips/trip-format'

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
