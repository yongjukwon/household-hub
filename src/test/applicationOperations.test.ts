import { describe, expect, it, vi } from 'vitest'
import {
  createOperationReplayer,
  InMemoryOperationStore,
  type OperationResult,
  type QueuedOperation,
} from '@household-hub/application/operations'

const householdId = '11111111-1111-4111-8111-111111111111'

function operation(localSequence: number, id: string): QueuedOperation {
  return {
    operationId: id,
    localSequence,
    householdId,
    entityType: 'note',
    entityId: '22222222-2222-4222-8222-222222222222',
    command: {
      schemaVersion: 1,
      operationId: id as never,
      deviceId: '33333333-3333-4333-8333-333333333333' as never,
      localSequence,
      householdId: householdId as never,
      type: 'note.upsert',
      entityType: 'note',
      entityId: '22222222-2222-4222-8222-222222222222' as never,
      baseRevision: null,
      enqueuedAt: '2026-08-12T00:00:00.000Z',
      payload: { title: id },
    },
    optimistic: { id, title: id },
    enqueuedAt: '2026-08-12T00:00:00.000Z',
    attempts: 0,
    lastError: null,
  }
}

function applied(id: string): OperationResult {
  return { status: 'applied', operationId: id as never, serverSequence: 1 }
}

describe('shared operation replayer', () => {
  it('drains newly enqueued work during the same FIFO pass', async () => {
    const store = new InMemoryOperationStore()
    await store.addOperation(operation(1, '44444444-4444-4444-8444-444444444444'))
    const second = operation(2, '55555555-5555-4555-8555-555555555555')
    const apply = vi.fn(async (command) => {
      if (command.operationId === '44444444-4444-4444-8444-444444444444') {
        await store.addOperation(second)
      }
      return applied(command.operationId)
    })

    const summary = await createOperationReplayer({
      store,
      transport: { apply },
      isOnline: () => true,
      now: () => '2026-08-12T00:00:00.000Z',
    }).flush()

    expect(summary.applied).toBe(2)
    expect(summary.remaining).toBe(0)
    expect(apply).toHaveBeenCalledTimes(2)
  })

  it('records a server conflict and removes the command from pending work', async () => {
    const store = new InMemoryOperationStore()
    const entry = operation(1, '44444444-4444-4444-8444-444444444444')
    await store.addOperation(entry)
    const result: OperationResult = {
      status: 'conflict',
      operationId: entry.operationId as never,
      reason: 'stale revision',
      currentRevision: 2 as never,
      winner: {
        operationId: entry.operationId as never,
        type: 'note.upsert',
        entityType: 'note',
        entityId: entry.entityId as never,
        appliedAt: '2026-08-12T00:00:00.000Z',
      },
    }

    const summary = await createOperationReplayer({
      store,
      transport: { apply: async () => result },
      isOnline: () => true,
      now: () => '2026-08-12T00:00:00.000Z',
    }).flush()

    expect(summary.discarded).toBe(1)
    expect(await store.countOperations()).toBe(0)
    await expect(store.getDiscarded(entry.operationId)).resolves.toMatchObject({
      reason: 'conflict',
      explanation: 'stale revision',
    })
  })
})
