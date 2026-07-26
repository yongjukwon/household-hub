import { isRevision, isUuid } from '@household-hub/domain'
import type { OperationResult, Revision, UUID } from '@household-hub/domain'

// Network + Supabase are mocked; the store is the in-memory implementation.
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }))
jest.mock('@/lib/net', () => ({
  isOnline: jest.fn(),
  onReconnect: jest.fn(() => jest.fn()),
}))
jest.mock('@/lib/secure', () => {
  const store: Record<string, string> = {}
  return {
    getSecureItem: async (k: string) => store[k] ?? null,
    setSecureItem: async (k: string, v: string) => {
      store[k] = v
    },
    deleteSecureItem: async (k: string) => {
      delete store[k]
    },
  }
})

import { supabase } from '@/lib/supabase'
import { isOnline } from '@/lib/net'
import {
  acknowledgeDiscard,
  applyOptimisticOverlay,
  enqueueOperation,
  flushOperations,
  getDeviceId,
  hasPendingOperations,
  InMemoryOperationStore,
  pendingOperations,
  resetDeviceIdentity,
  setOperationStore,
  unacknowledgedDiscards,
  withOptimisticOverlay,
  type EnqueueInput,
} from './index'

const mockRpc = supabase.rpc as jest.Mock
const mockIsOnline = isOnline as jest.Mock

function uuid(value: string): UUID {
  if (!isUuid(value)) throw new Error(`not a UUID: ${value}`)
  return value
}

function revision(value: number): Revision {
  if (!isRevision(value)) throw new Error(`not a revision: ${value}`)
  return value
}

const HOUSEHOLD = uuid('11111111-1111-4111-8111-111111111111')
const EVENT_A = uuid('22222222-2222-4222-8222-222222222222')
const EVENT_B = uuid('33333333-3333-4333-8333-333333333333')

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

let store: InMemoryOperationStore

beforeEach(async () => {
  store = new InMemoryOperationStore()
  setOperationStore(store)
  mockRpc.mockReset()
  mockIsOnline.mockResolvedValue(true)
  await resetDeviceIdentity()
  respondWith((command) => applied(command.operationId))
})

afterEach(() => {
  setOperationStore(null)
})

describe('durable operation queue', () => {
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
        queuedWhenSendBegan = await store.countOperations()
        return { data: applied(args.command.operationId), error: null }
      },
    )

    await enqueueOperation(upsertEvent(EVENT_A))

    expect(queuedWhenSendBegan).toBe(1)
    expect(await store.countOperations()).toBe(0)
  })

  it('queues offline without contacting the server', async () => {
    mockIsOnline.mockResolvedValue(false)

    const outcome = await enqueueOperation(upsertEvent(EVENT_A))

    expect(outcome.status).toBe('queued')
    expect(mockRpc).not.toHaveBeenCalled()
    expect(await store.countOperations()).toBe(1)
  })

  it('replays queued commands in local FIFO order on reconnect', async () => {
    mockIsOnline.mockResolvedValue(false)
    await enqueueOperation(upsertEvent(EVENT_A))
    await enqueueOperation(upsertEvent(EVENT_B))
    expect(await store.countOperations()).toBe(2)

    mockIsOnline.mockResolvedValue(true)
    const summary = await flushOperations()

    expect(summary.applied).toBe(2)
    expect(await store.countOperations()).toBe(0)
    const sentOrder = mockRpc.mock.calls.map((c) => c[1].command.localSequence)
    expect(sentOrder).toEqual([1, 2])
  })

  it('survives a relaunch: commands persisted while offline still replay', async () => {
    mockIsOnline.mockResolvedValue(false)
    await enqueueOperation(upsertEvent(EVENT_A))

    // Simulate a relaunch: the in-flight flush guard resets, but the durable
    // store keeps the command. A fresh online flush must send it.
    mockIsOnline.mockResolvedValue(true)
    const summary = await flushOperations()

    expect(summary.applied).toBe(1)
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('removes a duplicate command without re-applying it', async () => {
    respondWith((command) => ({
      status: 'duplicate',
      operationId: command.operationId,
      serverSequence: 5,
    }))

    const outcome = await enqueueOperation(upsertEvent(EVENT_A))

    expect(outcome.status).toBe('settled')
    expect(await store.countOperations()).toBe(0)
  })

  it('stops the pass on a transport failure instead of skipping ahead', async () => {
    mockIsOnline.mockResolvedValue(false)
    await enqueueOperation(upsertEvent(EVENT_A))
    await enqueueOperation(upsertEvent(EVENT_B))

    mockIsOnline.mockResolvedValue(true)
    mockRpc.mockRejectedValueOnce(new Error('network down'))

    const summary = await flushOperations()

    expect(summary.stoppedBy).toBe('network down')
    // Neither command left the queue; the second never got a turn.
    expect(await store.countOperations()).toBe(2)
    expect(mockRpc).toHaveBeenCalledTimes(1)
    const first = (await pendingOperations())[0]
    expect(first.attempts).toBe(1)
    expect(first.lastError).toBe('network down')
  })

  it('permanently discards a conflicted command with an explanation', async () => {
    respondWith((command) => ({
      status: 'conflict',
      operationId: command.operationId,
      reason: 'The event was changed on another device.',
      currentRevision: revision(3),
      winner: {
        operationId: uuid('44444444-4444-4444-8444-444444444444'),
        type: 'calendar.event.upsert',
        entityType: 'calendar_event',
        entityId: EVENT_A,
        appliedAt: '2026-07-25T00:00:00.000Z',
      },
    }))

    const outcome = await enqueueOperation(upsertEvent(EVENT_A))

    expect(outcome.status).toBe('discarded')
    expect(await store.countOperations()).toBe(0)
    const discards = await unacknowledgedDiscards()
    expect(discards).toHaveLength(1)
    expect(discards[0].reason).toBe('conflict')
    expect(discards[0].winner?.entityId).toBe(EVENT_A)
  })

  it('permanently discards a rejected command and can be acknowledged', async () => {
    respondWith((command) => ({
      status: 'rejected',
      operationId: command.operationId,
      code: 'invalid_payload',
      reason: 'Missing title.',
      details: { field: 'title' },
      warnings: [],
    }))

    const outcome = await enqueueOperation(upsertEvent(EVENT_A))
    expect(outcome.status).toBe('discarded')

    let discards = await unacknowledgedDiscards()
    expect(discards).toHaveLength(1)
    expect(discards[0].code).toBe('invalid_payload')

    await acknowledgeDiscard(discards[0].operationId)
    discards = await unacknowledgedDiscards()
    expect(discards).toHaveLength(0)
  })

  it('exposes a still-queued command as pending for its entity', async () => {
    mockIsOnline.mockResolvedValue(false)
    await enqueueOperation(upsertEvent(EVENT_A))

    expect(await hasPendingOperations('calendar_event', EVENT_A)).toBe(true)
    expect(await hasPendingOperations('calendar_event', EVENT_B)).toBe(false)
  })

  it('overlays a queued edit on top of a stale server read', async () => {
    mockIsOnline.mockResolvedValue(false)
    await enqueueOperation(
      upsertEvent(EVENT_A, { optimistic: { id: EVENT_A, title: 'Renamed' } }),
    )

    const serverRows = [{ id: EVENT_A, title: 'Old title' }]
    const merged = await withOptimisticOverlay(serverRows, 'calendar_event')

    expect(merged).toEqual([{ id: EVENT_A, title: 'Renamed', revision: 1 }])
  })

  it('repairs the revision on a legacy optimistic create before exposing it', () => {
    const merged = applyOptimisticOverlay(
      [],
      [
        {
          operationId: uuid('55555555-5555-4555-8555-555555555555'),
          localSequence: 1,
          householdId: HOUSEHOLD,
          entityType: 'trip',
          entityId: EVENT_A,
          command: {
            baseRevision: null,
          } as never,
          // Mobile builds before the revision projection fix stored this shape.
          optimistic: { name: 'London' },
          enqueuedAt: '2026-07-25T00:00:00.000Z',
          attempts: 0,
          lastError: null,
        },
      ],
      'trip',
    )

    expect(merged).toEqual([
      { id: EVENT_A, name: 'London', revision: 1 },
    ])
  })

  it('applyOptimisticOverlay removes an entity a queued delete targets', () => {
    const rows = [
      { id: EVENT_A, title: 'A' },
      { id: EVENT_B, title: 'B' },
    ]
    const merged = applyOptimisticOverlay(
      rows,
      [
        {
          operationId: uuid('55555555-5555-4555-8555-555555555555'),
          localSequence: 1,
          householdId: HOUSEHOLD,
          entityType: 'calendar_event',
          entityId: EVENT_A,
          command: {} as never,
          optimistic: null,
          enqueuedAt: '2026-07-25T00:00:00.000Z',
          attempts: 0,
          lastError: null,
        },
      ],
      'calendar_event',
    )
    expect(merged).toEqual([{ id: EVENT_B, title: 'B' }])
  })
})
