import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import { latestPriceByName, normalizeItemName } from '@/features/groceries/data'

describe('parseDollarsToCents', () => {
  it('parses a plain decimal to cents', () => {
    expect(parseDollarsToCents('12.50')).toBe(1250)
    expect(parseDollarsToCents('3')).toBe(300)
    expect(parseDollarsToCents('0.99')).toBe(99)
  })

  it('strips currency symbols and separators', () => {
    expect(parseDollarsToCents('$1,234.56')).toBe(123456)
  })

  it('returns null for empty or invalid input', () => {
    expect(parseDollarsToCents('')).toBeNull()
    expect(parseDollarsToCents('.')).toBeNull()
    expect(parseDollarsToCents('abc')).toBeNull()
  })

  it('rounds a sub-cent third decimal to the nearest cent', () => {
    expect(parseDollarsToCents('1.999')).toBe(200)
    expect(parseDollarsToCents('1.994')).toBe(199)
  })
})

describe('centsToInputValue', () => {
  it('renders cents as a 2-decimal string', () => {
    expect(centsToInputValue(1250)).toBe('12.50')
    expect(centsToInputValue(0)).toBe('0.00')
  })

  it('renders null/undefined as empty', () => {
    expect(centsToInputValue(null)).toBe('')
    expect(centsToInputValue(undefined)).toBe('')
  })
})

describe('normalizeItemName', () => {
  it('lowercases and trims', () => {
    expect(normalizeItemName('  Milk ')).toBe('milk')
  })
})

describe('latestPriceByName', () => {
  it('keeps the most recent entry per normalized name', () => {
    const latest = latestPriceByName([
      { id: '1', itemNameNormalized: 'milk', itemName: 'Milk', priceCents: 400, recordedAt: '2026-07-01T00:00:00Z', listName: 'Market' },
      { id: '2', itemNameNormalized: 'milk', itemName: 'Milk', priceCents: 450, recordedAt: '2026-07-05T00:00:00Z', listName: 'Costco' },
      { id: '3', itemNameNormalized: 'eggs', itemName: 'Eggs', priceCents: 600, recordedAt: '2026-07-02T00:00:00Z', listName: 'Market' },
    ])
    expect(latest.get('milk')?.priceCents).toBe(450)
    expect(latest.get('eggs')?.priceCents).toBe(600)
  })
})
