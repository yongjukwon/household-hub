import { describe, expect, it } from 'vitest'
import {
  applyLedgerConfigurationOverlay,
  categoryProgress,
  ensureLedgerYearMonths,
  monthSummaries,
  statementTotals,
  type LedgerYearData,
} from '@household-hub/application/feature-data'

const months = Array.from({ length: 12 }, (_, index) => ({ id: `m${index + 1}`, month: index + 1 }))
const base = (over: Partial<LedgerYearData> = {}): LedgerYearData => ({ months, categories: [], limits: [], transactions: [], ...over })

describe('shared Ledger year read model', () => {
  it('creates a twelve-month shell and projects queued configuration', () => {
    expect(ensureLedgerYearMonths('year', { months: [], categories: [], limits: [], transactions: [] }).months).toHaveLength(12)
    const result = applyLedgerConfigurationOverlay(base(), [{
      operationId: 'op', localSequence: 1, householdId: 'h', entityType: 'ledger_category', entityId: 'food',
      command: { schemaVersion: 1, operationId: 'op' as never, deviceId: 'd' as never, localSequence: 1, householdId: 'h' as never, type: 'ledger.category.upsert', entityType: 'ledger_category', entityId: 'food' as never, baseRevision: null, enqueuedAt: '2026-08-12T00:00:00.000Z', payload: { yearId: 'year', fromMonth: 7, name: 'Food', kind: 'spending', sortOrder: 0 } },
      optimistic: {}, enqueuedAt: '', attempts: 0, lastError: null,
    }], 'year')
    expect(result.categories).toHaveLength(6)
    expect(categoryProgress(result, 'm7')[0].name).toBe('Food')
  })

  it('calculates summaries and totals from the same projected snapshot', () => {
    const data = base({
      categories: [{ id: 'c', categoryId: 'food', monthId: 'm7', name: 'Food', kind: 'spending', sortOrder: 0, revision: 1 }],
      limits: [{ categoryId: 'food', monthId: 'm7', amountCents: 100, limitEntityId: 'food', revision: 1 }],
      transactions: [{ id: 't', monthId: 'm7', categoryId: 'food', assetId: 'a', kind: 'spending', amountCents: 120, occurredAt: '', description: '', revision: 1 }],
    })
    expect(monthSummaries(data).find((row) => row.month === 7)).toMatchObject({ spendingCents: 120, netCents: -120 })
    expect(statementTotals(data)).toMatchObject({ spendingCents: 120, limitCents: 100, leftCents: -20 })
  })
})
