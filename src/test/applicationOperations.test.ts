import { describe, expect, it, vi } from 'vitest'
import {
  createOperationReplayer,
  InMemoryOperationStore,
  type OperationResult,
  type QueuedOperation,
} from '@household-hub/application/operations'
import * as sharedOperations from '@household-hub/application/operations'

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

  it('replays a legacy Grocery command byte-for-byte', async () => {
    const store = new InMemoryOperationStore()
    const entry = operation(1, '66666666-6666-4666-8666-666666666666')
    entry.entityType = 'grocery_item'
    entry.command.type = 'grocery.item.upsert'
    entry.command.entityType = 'grocery_item'
    entry.command.payload = {
      listId: '77777777-7777-4777-8777-777777777777',
      name: 'Milk',
      quantity: '1',
      checked: false,
      unitPriceCents: 499,
      sortOrder: 0,
    }
    await store.addOperation(entry)
    const apply = vi.fn(async (command) => applied(command.operationId))

    await createOperationReplayer({
      store,
      transport: { apply },
      isOnline: () => true,
      now: () => '2026-08-12T00:00:00.000Z',
    }).flush()

    expect(apply).toHaveBeenCalledWith(entry.command)
  })
})

describe('shared optimistic operation projection', () => {
  const applyOptimisticOverlay = (
    sharedOperations as typeof sharedOperations & {
      applyOptimisticOverlay?: <Row extends { id: string }>(
        rows: Row[],
        operations: QueuedOperation[],
        entityType: string,
        householdId?: string,
      ) => Row[]
    }
  ).applyOptimisticOverlay

  it('layers queued settings patches over the server profile in FIFO order', () => {
    const first = operation(1, '77777777-7777-4777-8777-777777777771')
    first.entityType = 'settings'
    first.entityId = '88888888-8888-4888-8888-888888888888'
    first.command.type = 'settings.update'
    first.command.entityType = 'settings'
    first.command.entityId = first.entityId as never
    first.optimistic = { mobileNavigation: ['notes', 'trips', 'groceries'] }
    const second = structuredClone(first)
    second.operationId = '77777777-7777-4777-8777-777777777772'
    second.command.operationId = second.operationId as never
    second.localSequence = 2
    second.optimistic = { suppressUnpricedPurchaseWarning: true }

    expect(applyOptimisticOverlay?.([
      {
        id: first.entityId,
        displayName: 'Yongju',
        mobileNavigation: ['groceries', 'ledger', 'trips'],
        suppressUnpricedPurchaseWarning: false,
        revision: 3,
      },
    ], [second, first], 'settings', householdId)).toEqual([
      {
        id: first.entityId,
        displayName: 'Yongju',
        mobileNavigation: ['notes', 'trips', 'groceries'],
        suppressUnpricedPurchaseWarning: true,
        revision: 3,
      },
    ])
  })

  it('clears only the addressed household notification projection', () => {
    const clear = operation(1, '77777777-7777-4777-8777-777777777773')
    clear.entityType = 'notification'
    clear.command.type = 'notification.clear'
    clear.command.entityType = 'notification'
    clear.optimistic = null

    const rows = [{ id: '99999999-9999-4999-8999-999999999999' }]
    expect(applyOptimisticOverlay?.(rows, [clear], 'notification', householdId))
      .toEqual([])
    expect(applyOptimisticOverlay?.(
      rows,
      [clear],
      'notification',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )).toEqual(rows)
  })

  it('repairs legacy create revisions and treats legacy Ledger clears as destructive', () => {
    const create = operation(1, '77777777-7777-4777-8777-777777777774')
    create.entityType = 'trip'
    create.entityId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab'
    create.command.type = 'trip.upsert'
    create.command.entityType = 'trip'
    create.command.entityId = create.entityId as never
    create.optimistic = { name: 'London' }

    expect(applyOptimisticOverlay?.([], [create], 'trip', householdId))
      .toEqual([{ id: create.entityId, name: 'London', revision: 1 }])

    const clear = operation(2, '77777777-7777-4777-8777-777777777775')
    clear.entityType = 'ledger_year'
    clear.entityId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac'
    clear.command.type = 'ledger.year.clear'
    clear.command.entityType = 'ledger_year'
    clear.command.entityId = clear.entityId as never
    clear.optimistic = { year: 2026, confirmation: '2026' }

    expect(applyOptimisticOverlay?.(
      [{ id: clear.entityId, year: 2026, revision: 2 }],
      [clear],
      'ledger_year',
      householdId,
    )).toEqual([])
  })
})
