import { enqueueOperation } from '@/lib/operations'
import { clearYear } from './statementMutations'

jest.mock('@/lib/operations', () => ({
  enqueueOperation: jest.fn().mockResolvedValue({
    status: 'queued',
    operationId: '99999999-9999-4999-8999-999999999999',
  }),
}))

const mockedEnqueue = enqueueOperation as jest.MockedFunction<
  typeof enqueueOperation
>

describe('Statement mutations', () => {
  beforeEach(() => {
    mockedEnqueue.mockClear()
  })

  it('projects a cleared Statement year as deleted while it is queued', async () => {
    await clearYear(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      2026,
      3,
    )

    expect(mockedEnqueue).toHaveBeenCalledWith({
      householdId: '11111111-1111-4111-8111-111111111111',
      type: 'ledger.year.clear',
      entityType: 'ledger_year',
      entityId: '22222222-2222-4222-8222-222222222222',
      baseRevision: 3,
      payload: { year: 2026, confirmation: '2026' },
      optimistic: null,
    })
  })
})
