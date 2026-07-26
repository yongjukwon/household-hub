import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NewYearSheet } from '@/features/ledger/NewYearSheet'
import type { LedgerYear } from '@/features/ledger/statements'

vi.mock('@/features/ledger/statementMutations', () => ({
  createYear: vi.fn().mockResolvedValue({ status: 'applied' }),
}))

const existingYears: LedgerYear[] = [
  { id: 'y1', year: 2026, revision: 1 } as LedgerYear,
]

describe('NewYearSheet', () => {
  it('shows existing years as visible but disabled, and lets an uncreated year be picked', () => {
    render(
      <NewYearSheet open onOpenChange={() => {}} householdId="hh1" years={existingYears} />,
    )
    const select = screen.getByLabelText('Year') as HTMLSelectElement
    const existingOption = Array.from(select.options).find((o) => o.value === '2026')
    expect(existingOption?.disabled).toBe(true)
    const openOption = Array.from(select.options).find((o) => o.value === '2027')
    expect(openOption?.disabled).toBe(false)
    fireEvent.change(select, { target: { value: '2027' } })
    expect(select.value).toBe('2027')
  })
})
