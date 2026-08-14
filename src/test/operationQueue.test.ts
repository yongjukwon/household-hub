import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isRevision,
  isUuid,
  type OperationResult,
  type Revision,
  type UUID,
} from '@household-hub/domain'

import { db } from '@/lib/db'
import {
  acknowledgeDiscard,
  applyOptimisticOverlay,
  enqueueOperation,
  flushOperations,
  getDeviceId,
  hasPendingOperations,
  pendingOperations,
  resetDeviceIdentity,
  unacknowledgedDiscards,
  withOptimisticOverlay,
  type EnqueueInput,
} from '@/lib/operations'
import { mockRpc, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

/** Brands a literal through the domain guard, so a typo fails the test. */
function uuid(value: string): UUID {
  if (!isUuid(value)) throw new Error(`not a UUID: ${value}`)
  return value
}

function revision(value: number): Revision {
  if (!isRevision(value)) throw new Error(`not a revision: ${value}`)
  return value
}

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111'
const EVENT_A = '22222222-2222-4222-8222-222222222222'
const EVENT_B = '33333333-3333-4333-8333-333333333333'

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

function upsertEvent(
  entityId: string,
  overrides: Partial<EnqueueInput> = {},
): EnqueueInput {
  return {
    householdId: HOUSEHOLD,
    type: 'calendar.event.upsert',
    entityType: 'calendar_event',
    entityId,
    baseRevision: null,
    payload: { title: 'Dentist' },
    optimistic: { id: entityId, title: 'Dentist' },
    ...overrides,
  }
}

/** Server verdicts, keyed so a mock can answer per command. */
function respondWith(
  byOperation: (command: { operationId: UUID }) => OperationResult,
) {
  mockRpc.mockImplementation(
    async (_name: string, args: { command: { operationId: UUID } }) => ({
      data: byOperation(args.command),
      error: null,
    }),
  )
}

const applied = (operationId: UUID, serverSequence = 1): OperationResult => ({
  status: 'applied',
  operationId,
  serverSequence,
  entityRevision: revision(1),
})

describe('durable operation queue', () => {
  beforeEach(async () => {
    resetSupabaseMocks()
    await db.operations.clear()
    await db.discardedOperations.clear()
    await resetDeviceIdentity()
    setOnline(true)
    respondWith((command) => applied(command.operationId))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the shared command contract, not a table write', async () => {
    await enqueueOperation(upsertEvent(EVENT_A))

    expect(mockRpc).toHaveBeenCalledTimes(1)
    const [name, args] = mockRpc.mock.calls[0]
    expect(name).toBe('apply_household_operation')
    expect(args.command).toMatchObject({
      schemaVersion: 1,
      householdId: HOUSEHOLD,
      type: 'calendar.event.upsert',
      entityType: 'calendar_event',
      entityId: EVENT_A,
      baseRevision: null,
      payload: { title: 'Dentist' },
    })
    expect(args.command.deviceId).toBe(await getDeviceId())
    expect(args.command.localSequence).toBe(1)
  })

  it('stores the command before sending, so a crash mid-request cannot lose it', async () => {
    let queuedWhenSendBegan = -1
    mockRpc.mockImplementation(
      async (_name: string, args: { command: { operationId: UUID } }) => {
        queuedWhenSendBegan = await db.operations.count()
        return { data: applied(args.command.operationId), error: null }
      },
    )

    await enqueueOperation(upsertEvent(EVENT_A))

    expect(queuedWhenSendBegan).toBe(1)
    expect(await db.operations.count()).toBe(0)
  })

  it('queues offline without contacting the server', async () => {
    setOnline(false)
    const outcome = await enqueueOperation(upsertEvent(EVENT_A))

    expect(outcome.status).toBe('queued')
    expect(mockRpc).not.toHaveBeenCalled()
    expect(await db.operations.count()).toBe(1)
  })

  it('replays offline work in local FIFO order when the connection returns', async () => {
    setOnline(false)
    await enqueueOperation(upsertEvent(EVENT_A))
    await enqueueOperation(upsertEvent(EVENT_B))
    await enqueueOperation(
      upsertEvent(EVENT_A, {
        payload: { title: 'Dentist (moved)' },
        optimistic: { id: EVENT_A, title: 'Dentist (moved)' },
        baseRevision: 1,
      }),
    )

    setOnline(true)
    const summary = await flushOperations()

    expect(summary.applied).toBe(3)
    expect(summary.remaining).toBe(0)
    expect(
      mockRpc.mock.calls.map(([, args]) => args.command.localSequence),
    ).toEqual([1, 2, 3])
  })

  it('resumes a queue left behind by a previous session', async () => {
    setOnline(false)
    await enqueueOperation(upsertEvent(EVENT_A))

    // A reload keeps nothing in memory; the queue is read back from IndexedDB.
    setOnline(true)
    const summary = await flushOperations()

    expect(summary.applied).toBe(1)
    expect(await pendingOperations()).toEqual([])
  })

  it('treats a duplicate verdict as success, not as a repeated write', async () => {
    setOnline(false)
    await enqueueOperation(upsertEvent(EVENT_A))
    setOnline(true)

    respondWith((command) => ({
      status: 'duplicate',
      operationId: command.operationId,
      serverSequence: 7,
    }))

    const summary = await flushOperations()
    expect(summary.duplicate).toBe(1)
    expect(await db.operations.count()).toBe(0)
    expect(await unacknowledgedDiscards()).toEqual([])
  })

  it('drains a command enqueued while another is still in flight, instead of leaving it for the next flush', async () => {
    // Real-world race: a user adds item A, then adds item B (same name, new
    // price) before A's network round trip has returned. Both enqueueOperation
    // calls are online and call flushOperations(); the second reuses the
    // first's in-flight promise via the module-level flush singleton. If that
    // pass only ever looks at the snapshot it took before A's request was
    // sent, B never gets a turn in this pass — its own enqueueOperation
    // resolves to 'queued' even though the server was reachable and A just
    // went through, and nothing flushes it again until the next
    // online/visibility/timer event (30s+ later in production).
    let releaseA: (() => void) | undefined
    const aGate = new Promise<void>((resolve) => {
      releaseA = resolve
    })

    mockRpc.mockImplementation(
      async (_name: string, args: { command: { operationId: UUID; entityId: string } }) => {
        if (args.command.entityId === EVENT_A) await aGate
        return { data: applied(args.command.operationId), error: null }
      },
    )

    // Deterministically wait until the flush pass has taken its snapshot of
    // the store before enqueueing B, rather than counting microtask ticks —
    // that snapshot is the exact race window this test targets.
    let snapshotTaken: (() => void) | undefined
    const snapshotGate = new Promise<void>((resolve) => {
      snapshotTaken = resolve
    })
    type OrderBy = typeof db.operations.orderBy
    const originalOrderBy: OrderBy = db.operations.orderBy.bind(db.operations)
    vi.spyOn(db.operations, 'orderBy').mockImplementation(((
      ...args: Parameters<OrderBy>
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only Dexie query interception
      const query = (originalOrderBy as any)(...args)
      const originalToArray = query.toArray.bind(query)
      query.toArray = async () => {
        const result = await originalToArray()
        snapshotTaken?.()
        snapshotTaken = undefined
        return result
      }
      return query
    }) as OrderBy)

    const firstOutcome = enqueueOperation(upsertEvent(EVENT_A))
    await snapshotGate

    const secondOutcome = enqueueOperation(upsertEvent(EVENT_B))
    // Wait for B to be durably written (and, in turn, for its own
    // flushOperations() call to have reused A's still-in-flight promise)
    // before releasing A — fake-indexeddb's writes settle over real
    // macrotasks, so a fixed microtask-tick count isn't a reliable gate here.
    while ((await db.operations.count()) < 2) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    await Promise.resolve()
    releaseA?.()

    const [first, second] = await Promise.all([firstOutcome, secondOutcome])

    expect(first.status).toBe('settled')
    expect(second.status).toBe('settled')
    expect(await db.operations.count()).toBe(0)
  })

  it('stops the pass on a transport failure and keeps order intact', async () => {
    setOnline(false)
    await enqueueOperation(upsertEvent(EVENT_A))
    await enqueueOperation(upsertEvent(EVENT_B))
    setOnline(true)

    mockRpc.mockRejectedValueOnce(new Error('Failed to fetch'))
    const summary = await flushOperations()

    expect(summary.stoppedBy).toBe('Failed to fetch')
    expect(summary.applied).toBe(0)
    expect(summary.remaining).toBe(2)

    const [first] = await pendingOperations()
    expect(first.attempts).toBe(1)
    expect(first.lastError).toBe('Failed to fetch')

    // The retry starts from the same command, so the second never overtakes it.
    respondWith((command) => applied(command.operationId))
    const retry = await flushOperations()
    expect(retry.applied).toBe(2)
    expect(
      mockRpc.mock.calls.slice(1).map(([, args]) => args.command.localSequence),
    ).toEqual([1, 2])
  })

  it('keeps a command enqueued mid-failure queued for a later pass instead of skipping ahead to it', async () => {
    // Combines the two mechanics above: A's network call is gated (like the
    // concurrent-enqueue test), but instead of eventually succeeding, its
    // *first* attempt throws a transport error (like the transport-failure
    // test) — and B is durably enqueued while A is still gated in flight, not
    // before the pass starts. This is the one combination that actually
    // exercises the `break drain` label: a plain `break` would only exit the
    // inner per-batch loop, so the outer while(true) would re-list, find B
    // (which arrived mid-pass) sitting right next to a *still-unprocessed* A,
    // and press on — sending B (and retrying A) before this pass ever
    // reported A's failure. That skips ahead of a command whose fate this
    // pass hasn't resolved yet, exactly what `break drain` exists to prevent.
    let releaseA: (() => void) | undefined
    const aGate = new Promise<void>((resolve) => {
      releaseA = resolve
    })
    let aAttempts = 0

    mockRpc.mockImplementation(
      async (_name: string, args: { command: { operationId: UUID; entityId: string } }) => {
        if (args.command.entityId === EVENT_A) {
          await aGate
          aAttempts += 1
          if (aAttempts === 1) throw new Error('Failed to fetch')
        }
        return { data: applied(args.command.operationId), error: null }
      },
    )

    // Same snapshot-gate technique as the concurrent-enqueue test: wait until
    // the pass has taken its snapshot of the store (containing only A so far)
    // before enqueueing B.
    let snapshotTaken: (() => void) | undefined
    const snapshotGate = new Promise<void>((resolve) => {
      snapshotTaken = resolve
    })
    type OrderBy = typeof db.operations.orderBy
    const originalOrderBy: OrderBy = db.operations.orderBy.bind(db.operations)
    vi.spyOn(db.operations, 'orderBy').mockImplementation(((
      ...args: Parameters<OrderBy>
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only Dexie query interception
      const query = (originalOrderBy as any)(...args)
      const originalToArray = query.toArray.bind(query)
      query.toArray = async () => {
        const result = await originalToArray()
        snapshotTaken?.()
        snapshotTaken = undefined
        return result
      }
      return query
    }) as OrderBy)

    const firstOutcome = enqueueOperation(upsertEvent(EVENT_A))
    await snapshotGate

    const secondOutcome = enqueueOperation(upsertEvent(EVENT_B))
    // Wait for B to be durably written before releasing A's failure — same
    // reasoning as the concurrent-enqueue test: fake-indexeddb writes settle
    // over real macrotasks, so a fixed tick count isn't a reliable gate.
    while ((await db.operations.count()) < 2) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    await Promise.resolve()
    releaseA?.()

    const [first, second] = await Promise.all([firstOutcome, secondOutcome])

    // A's failure never got a verdict recorded this pass, so neither caller
    // sees anything but "still queued" — the pass stopped, it didn't settle.
    expect(first.status).toBe('queued')
    expect(second.status).toBe('queued')
    // Only A's single (failing) attempt happened in this pass; B was never
    // sent, and A was never retried within the same pass.
    expect(mockRpc).toHaveBeenCalledTimes(1)

    const stalled = await pendingOperations()
    expect(stalled).toHaveLength(2)
    expect(stalled[0].entityId).toBe(EVENT_A)
    expect(stalled[0].attempts).toBe(1)
    expect(stalled[0].lastError).toBe('Failed to fetch')
    expect(stalled[1].entityId).toBe(EVENT_B)
    expect(stalled[1].attempts).toBe(0)

    // B was not silently lost: a later flush (the mock now lets A through on
    // its second attempt) still picks it up, in FIFO order behind A.
    const retry = await flushOperations()
    expect(retry.applied).toBe(2)
    expect(
      mockRpc.mock.calls.slice(1).map(([, args]) => args.command.localSequence),
    ).toEqual([1, 2])
    expect(await pendingOperations()).toEqual([])
  })

  it('never drops a command because of an unrecognized response', async () => {
    setOnline(false)
    await enqueueOperation(upsertEvent(EVENT_A))
    setOnline(true)

    mockRpc.mockResolvedValueOnce({ data: { status: 'weird' }, error: null })
    const summary = await flushOperations()

    expect(summary.stoppedBy).toMatch(/unrecognized/)
    expect(await db.operations.count()).toBe(1)
  })

  it('discards a conflict permanently and explains what won', async () => {
    const winner = {
      operationId: uuid('44444444-4444-4444-8444-444444444444'),
      type: 'calendar.event.upsert' as const,
      entityType: 'calendar_event',
      entityId: uuid(EVENT_A),
      appliedAt: '2026-07-25T10:00:00.000Z',
    }
    respondWith((command) => ({
      status: 'conflict',
      operationId: command.operationId,
      reason: 'Entity was changed by another operation',
      currentRevision: revision(4),
      winner,
    }))

    const outcome = await enqueueOperation(
      upsertEvent(EVENT_A, { baseRevision: 2 }),
    )

    expect(outcome.status).toBe('discarded')
    expect(await db.operations.count()).toBe(0)

    const [record] = await unacknowledgedDiscards()
    expect(record.reason).toBe('conflict')
    expect(record.winner).toEqual(winner)
    expect(record.explanation).toBe('Entity was changed by another operation')
    expect(record.details).toEqual({ currentRevision: 4 })
    // The failed command itself is kept, so the UI can name what was lost.
    expect(record.command.payload).toEqual({ title: 'Dentist' })

    // Discarded means discarded: a later flush must not resend it.
    await flushOperations()
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('keeps replaying after another device wins one of the queued entities', async () => {
    setOnline(false)
    await enqueueOperation(upsertEvent(EVENT_A))
    await enqueueOperation(upsertEvent(EVENT_B, { baseRevision: 1 }))
    await enqueueOperation(
      upsertEvent(EVENT_A, { baseRevision: 1, payload: { title: 'Later' } }),
    )
    setOnline(true)

    const sent = await pendingOperations()

    // The partner's device already changed EVENT_B, so only that command loses;
    // the rest of this device's queue still applies, in order.
    respondWith((command) => {
      const queued = sent.find(
        (entry) => entry.operationId === command.operationId,
      )
      if (queued?.entityId === EVENT_B) {
        return {
          status: 'conflict',
          operationId: command.operationId,
          reason: 'Entity was changed by another operation',
          currentRevision: revision(2),
          winner: {
            operationId: uuid('88888888-8888-4888-8888-888888888888'),
            type: 'calendar.event.upsert',
            entityType: 'calendar_event',
            entityId: uuid(EVENT_B),
            appliedAt: '2026-07-25T10:00:00.000Z',
          },
        }
      }
      return applied(command.operationId)
    })

    const summary = await flushOperations()

    expect(summary.applied).toBe(2)
    expect(summary.discarded).toBe(1)
    expect(summary.remaining).toBe(0)
    expect(
      mockRpc.mock.calls.map(([, args]) => args.command.localSequence),
    ).toEqual([1, 2, 3])

    const [record] = await unacknowledgedDiscards()
    expect(record.command.entityId).toBe(EVENT_B)
  })

  it('discards a rejection with its stable code and warnings', async () => {
    respondWith((command) => ({
      status: 'rejected',
      operationId: command.operationId,
      code: 'category_has_spending',
      reason: 'Spending exists in a later month.',
      details: { blockingMonths: [7, 8] },
      warnings: [],
    }))

    const outcome = await enqueueOperation(upsertEvent(EVENT_A))
    expect(outcome.status).toBe('discarded')

    const [record] = await unacknowledgedDiscards()
    expect(record.reason).toBe('rejected')
    expect(record.code).toBe('category_has_spending')
    expect(record.details).toEqual({ blockingMonths: [7, 8] })
  })

  it('hides a discard record once the user acknowledges it', async () => {
    respondWith((command) => ({
      status: 'rejected',
      operationId: command.operationId,
      code: 'invalid',
      reason: 'No.',
      details: {},
      warnings: [],
    }))

    const outcome = await enqueueOperation(upsertEvent(EVENT_A))
    expect(outcome.status).toBe('discarded')
    if (outcome.status !== 'discarded') return

    await acknowledgeDiscard(outcome.operationId)
    expect(await unacknowledgedDiscards()).toEqual([])
    expect(await db.discardedOperations.count()).toBe(1)
  })

  it('assigns each command its own local sequence and id', async () => {
    setOnline(false)
    await enqueueOperation(upsertEvent(EVENT_A))
    await enqueueOperation(upsertEvent(EVENT_B))

    const queued = await pendingOperations()
    expect(queued.map((entry) => entry.localSequence)).toEqual([1, 2])
    expect(new Set(queued.map((entry) => entry.operationId)).size).toBe(2)
    // One device identity for both.
    expect(queued[0].command.deviceId).toBe(queued[1].command.deviceId)
  })

  it('keeps the device identity and sequence across sessions', async () => {
    setOnline(false)
    await enqueueOperation(upsertEvent(EVENT_A))
    const deviceId = await getDeviceId()

    // Simulate a reload: nothing in memory, same IndexedDB.
    await enqueueOperation(upsertEvent(EVENT_B))
    const queued = await pendingOperations()

    expect(await getDeviceId()).toBe(deviceId)
    expect(queued[1].localSequence).toBe(2)
  })
})

describe('optimistic overlay', () => {
  beforeEach(async () => {
    resetSupabaseMocks()
    await db.operations.clear()
    await db.discardedOperations.clear()
    await resetDeviceIdentity()
    setOnline(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('leaves server rows alone when nothing is queued', async () => {
    const rows = [{ id: EVENT_A, title: 'Dentist' }]
    expect(await withOptimisticOverlay(rows, 'calendar_event')).toEqual(rows)
  })

  it('keeps an unsent local edit visible over a fresh server read', async () => {
    await enqueueOperation(
      upsertEvent(EVENT_A, {
        payload: { title: 'Dentist (moved)' },
        optimistic: { title: 'Dentist (moved)' },
      }),
    )

    // What Realtime invalidation would refetch: the partner's version.
    const server = [{ id: EVENT_A, title: 'Dentist', note: 'from partner' }]
    const merged = await withOptimisticOverlay(server, 'calendar_event')

    expect(merged).toEqual([
      { id: EVENT_A, title: 'Dentist (moved)', note: 'from partner' },
    ])
  })

  it('shows a queued creation the server has not seen yet', async () => {
    await enqueueOperation(upsertEvent(EVENT_B))
    const merged = await withOptimisticOverlay(
      [{ id: EVENT_A, title: 'Dentist' }],
      'calendar_event',
    )

    expect(merged.map((row) => row.id)).toEqual([EVENT_A, EVENT_B])
  })

  it('hides a row whose deletion is still queued', async () => {
    await enqueueOperation(
      upsertEvent(EVENT_A, {
        type: 'calendar.event.delete',
        payload: {},
        optimistic: null,
      }),
    )

    expect(
      await withOptimisticOverlay(
        [{ id: EVENT_A, title: 'Dentist' }],
        'calendar_event',
      ),
    ).toEqual([])
  })

  it('applies queued commands for one entity in local sequence order', async () => {
    await enqueueOperation(
      upsertEvent(EVENT_A, { optimistic: { title: 'First' } }),
    )
    await enqueueOperation(
      upsertEvent(EVENT_A, { optimistic: { title: 'Second' } }),
    )

    const merged = await withOptimisticOverlay(
      [{ id: EVENT_A, title: 'Server' }],
      'calendar_event',
    )
    expect(merged).toEqual([{ id: EVENT_A, title: 'Second' }])
  })

  it('ignores commands for other entity types', () => {
    const rows = [{ id: EVENT_A, title: 'Dentist' }]
    const merged = applyOptimisticOverlay(
      rows,
      [
        {
          operationId: 'op-1',
          localSequence: 1,
          householdId: HOUSEHOLD,
          entityType: 'grocery_item',
          entityId: EVENT_A,
          command: {} as never,
          optimistic: { title: 'Milk' },
          enqueuedAt: '2026-07-25T10:00:00.000Z',
          attempts: 0,
          lastError: null,
        },
      ],
      'calendar_event',
    )
    expect(merged).toEqual(rows)
  })

  it('reports whether a specific entity still has unsent work', async () => {
    await enqueueOperation(upsertEvent(EVENT_A))

    expect(await hasPendingOperations('calendar_event', EVENT_A)).toBe(true)
    expect(await hasPendingOperations('calendar_event', EVENT_B)).toBe(false)
  })
})
