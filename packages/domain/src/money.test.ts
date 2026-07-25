import { describe, expect, it } from 'vitest'
import { formatMoney } from './index'

describe('formatMoney', () => {
  it('formats integer cents in their own currency without conversion', () => {
    expect(formatMoney(530900, 'CAD')).toBe('$5,309.00')
    expect(formatMoney(240900, 'GBP')).toBe('£2,409.00')
  })

  it('preserves a negative signed-cent amount', () => {
    expect(formatMoney(-150, 'CAD')).toBe('-$1.50')
  })
})
