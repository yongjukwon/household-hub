import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { isUuid, type OperationCommand, type UUID } from '@household-hub/domain'

import { db } from '@/lib/db'
import {
  acknowledgeDiscard,
  enqueueOperation,
  explainDiscard,
  resetDeviceIdentity,
  useDiscardedOperations,
  useOperationQueueStatus,
  type DiscardedOperation,
  type EnqueueInput,
} from '@/lib/operations'
import { mockRpc, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

function uuid(value: string): UUID {
  if (!isUuid(value)) throw new Error(`not a UUID: ${value}`)
  return value
}

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111'
const EVENT_A = '22222222-2222-4222-8222-222222222222'

const upsertEvent = (overrides: Partial<EnqueueInput> = {}): EnqueueInput => ({
  householdId: HOUSEHOLD,
  type: 'calendar.event.upsert',
  entityType: 'calendar_event',
  entityId: EVENT_A,
  baseRevision: null,
  payload: { title: 'Dentist' },
  optimistic: { id: EVENT_A, title: 'Dentist' },
  ...overrides,
})

const command = (overrides: Partial<OperationCommand> = {}): OperationCommand =>
  ({
    schemaVersion: 1,
    operationId: uuid('55555555-5555-4555-8555-555555555555'),
    deviceId: uuid('66666666-6666-4666-8666-666666666666'),
    localSequence: 1,
    householdId: uuid(HOUSEHOLD),
    type: 'calendar.event.upsert',
    entityType: 'calendar_event',
    entityId: uuid(EVENT_A),
    baseRevision: null,
    enqueuedAt: '2026-07-25T10:00:00.000Z',
    payload: {},
    ...overrides,
  }) as OperationCommand

const discard = (
  overrides: Partial<DiscardedOperation> = {},
): DiscardedOperation => ({
  operationId: '55555555-5555-4555-8555-555555555555',
  reason: 'conflict',
  command: command(),
  discardedAt: '2026-07-25T10:00:01.000Z',
  winner: {
    operationId: uuid('77777777-7777-4777-8777-777777777777'),
    type: 'calendar.event.upsert',
    entityType: 'calendar_event',
    entityId: uuid(EVENT_A),
    appliedAt: '2026-07-25T09:59:59.000Z',
  },
  code: null,
  explanation: 'Entity was changed by another operation',
  details: {},
  warnings: [],
  acknowledgedAt: null,
  ...overrides,
})

describe('explainDiscard', () => {
  it('names the failed action and what won a conflict', () => {
    expect(explainDiscard(discard())).toEqual({
      failedAction: 'Saving your calendar event did not go through.',
      winningAction:
        'The same calendar event was already changed on another device.',
      reason: 'Entity was changed by another operation',
      code: null,
    })
  })

  it('reports a losing delete as a delete', () => {
    const record = discard({
      command: command({ type: 'calendar.event.delete' }),
    })
    expect(explainDiscard(record).failedAction).toBe(
      'Deleting your calendar event did not go through.',
    )
  })

  it('says when the winner deleted the entity out from under the edit', () => {
    const record = discard({
      winner: {
        operationId: uuid('77777777-7777-4777-8777-777777777777'),
        type: 'calendar.event.delete',
        entityType: 'calendar_event',
        entityId: uuid(EVENT_A),
        appliedAt: '2026-07-25T09:59:59.000Z',
      },
    })
    expect(explainDiscard(record).winningAction).toBe(
      'The same calendar event was already deleted on another device.',
    )
  })

  it('carries the stable code through for a rejection', () => {
    const record = discard({
      reason: 'rejected',
      winner: null,
      code: 'category_has_spending',
      explanation: 'Spending exists in a later month.',
      command: command({
        type: 'ledger.category.delete',
        entityType: 'ledger_category',
      }),
    })

    expect(explainDiscard(record)).toEqual({
      failedAction: 'Deleting your category did not go through.',
      winningAction: null,
      reason: 'Spending exists in a later month.',
      code: 'category_has_spending',
    })
  })

  it('falls back to a readable noun for an unmapped entity type', () => {
    const record = discard({
      command: command({ entityType: 'some_new_thing' }),
    })
    expect(explainDiscard(record).failedAction).toBe(
      'Saving your some new thing did not go through.',
    )
  })
})

describe('queue status hooks', () => {
  beforeEach(async () => {
    resetSupabaseMocks()
    await db.operations.clear()
    await db.discardedOperations.clear()
    await resetDeviceIdentity()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('counts queued commands as they are added', async () => {
    const { result } = renderHook(() => useOperationQueueStatus())
    await waitFor(() => expect(result.current.pending).toBe(0))

    await enqueueOperation(upsertEvent())
    await waitFor(() => expect(result.current.pending).toBe(1))
  })

  it('surfaces discards until they are acknowledged', async () => {
    const { result } = renderHook(() => useDiscardedOperations())
    await waitFor(() => expect(result.current).toHaveLength(0))

    await db.discardedOperations.put(discard())
    await waitFor(() => expect(result.current).toHaveLength(1))

    await acknowledgeDiscard('55555555-5555-4555-8555-555555555555')
    await waitFor(() => expect(result.current).toHaveLength(0))
  })

  it('reports why the last replay stopped', async () => {
    const { result } = renderHook(() => useOperationQueueStatus())
    await enqueueOperation(upsertEvent())
    await waitFor(() => expect(result.current.pending).toBe(1))

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    mockRpc.mockRejectedValueOnce(new Error('Failed to fetch'))
    const { flushOperations } = await import('@/lib/operations')
    await flushOperations()

    await waitFor(() =>
      expect(result.current.lastError).toBe('Failed to fetch'),
    )
  })
})
