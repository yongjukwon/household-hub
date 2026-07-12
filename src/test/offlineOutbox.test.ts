import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { queueWrite } from '@/lib/offline/outbox'
import { flushOutbox, retryFailedWrites } from '@/lib/offline/syncManager'
import { mockFromResult, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

const write = {
  clientId: 'item-1',
  table: 'grocery_items' as const,
  op: 'upsert' as const,
  payload: { id: 'item-1', page_id: 'page-1', name: 'Milk', sort_order: 0 },
  match: { id: 'item-1' },
}

describe('offline outbox', () => {
  beforeEach(async () => {
    resetSupabaseMocks()
    await db.outbox.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('queues before sending: entry is durable even when the network attempt succeeds', async () => {
    setOnline(true)
    const builder = mockFromResult(null)
    // Capture queue state at the moment the network call begins.
    let queuedAtSendTime = -1
    builder.upsert.mockImplementation(() => {
      void db.outbox.count().then((count) => (queuedAtSendTime = count))
      return builder
    })

    const status = await queueWrite(write)

    expect(status).toBe('synced')
    await vi.waitFor(() => expect(queuedAtSendTime).toBe(1))
    expect(await db.outbox.count()).toBe(0) // dequeued after success
  })

  it('stays queued while offline without attempting the network', async () => {
    setOnline(false)
    const builder = mockFromResult(null)

    const status = await queueWrite(write)

    expect(status).toBe('queued')
    expect(builder.upsert).not.toHaveBeenCalled()
    expect(await db.outbox.count()).toBe(1)
  })

  it('stays queued when the network attempt throws mid-flight', async () => {
    setOnline(true)
    const builder = mockFromResult(null)
    builder.upsert.mockImplementation(() => {
      throw new TypeError('fetch failed')
    })

    const status = await queueWrite(write)

    expect(status).toBe('queued')
    expect(await db.outbox.count()).toBe(1)
  })

  it('flushes pending entries in order and dequeues them on success', async () => {
    setOnline(false)
    await queueWrite(write)
    await queueWrite({
      ...write,
      clientId: 'item-2',
      op: 'update',
      payload: { checked: true },
      match: { id: 'item-2', page_id: 'page-1' },
    })
    expect(await db.outbox.count()).toBe(2)

    setOnline(true)
    const builder = mockFromResult(null)
    await flushOutbox()

    expect(await db.outbox.count()).toBe(0)
    expect(builder.upsert).toHaveBeenCalledWith(write.payload, {
      onConflict: 'id',
    })
    expect(builder.update).toHaveBeenCalledWith({ checked: true })
    expect(builder.eq.mock.calls).toEqual([
      ['id', 'item-2'],
      ['page_id', 'page-1'],
    ])
  })

  it('does not flush while offline', async () => {
    setOnline(false)
    await queueWrite(write)
    const builder = mockFromResult(null)

    await flushOutbox()

    expect(builder.upsert).not.toHaveBeenCalled()
    expect(await db.outbox.count()).toBe(1)
  })

  it('aborts the pass on a network-level throw without penalizing entries', async () => {
    setOnline(false)
    await queueWrite(write)
    setOnline(true)
    const builder = mockFromResult(null)
    builder.upsert.mockImplementation(() => {
      throw new TypeError('fetch failed')
    })

    await flushOutbox()

    const entry = await db.outbox.toCollection().first()
    expect(entry?.status).toBe('pending')
    expect(entry?.retryCount).toBe(0)
  })

  it('caps server-rejected entries at 5 retries, flips to failed, and retryFailedWrites requeues them', async () => {
    setOnline(false)
    await queueWrite(write)
    setOnline(true)

    mockFromResult(null, { code: '23514', message: 'check violation' })
    for (let attempt = 0; attempt < 5; attempt++) {
      await flushOutbox()
    }
    const entry = await db.outbox.toCollection().first()
    expect(entry?.status).toBe('failed')
    expect(entry?.retryCount).toBe(5)

    // Sixth flush ignores failed entries entirely.
    const rejectingBuilder = mockFromResult(null, { code: '23514' })
    await flushOutbox()
    expect(rejectingBuilder.upsert).not.toHaveBeenCalled()

    // Manual retry resets the budget and syncs once the server accepts.
    mockFromResult(null)
    await retryFailedWrites()
    expect(await db.outbox.count()).toBe(0)
  })
})
