import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/lib/db'
import { drainLegacyOutbox } from '@/lib/offline/legacyOutboxMigration'
import { mockFromResult, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

const entry = {
  clientId: 'item-1',
  table: 'grocery_items' as const,
  op: 'upsert' as const,
  payload: { id: 'item-1', name: 'Milk' },
  match: { id: 'item-1' },
  createdAt: 1,
  retryCount: 0,
  status: 'pending' as const,
}

describe('legacy outbox migration', () => {
  beforeEach(async () => {
    resetSupabaseMocks()
    await db.outbox.clear()
  })

  afterEach(() => vi.restoreAllMocks())

  it('deletes a legacy entry only after the server accepts it', async () => {
    setOnline(true)
    await db.outbox.add(entry)
    const builder = mockFromResult(null)

    const result = await drainLegacyOutbox()

    expect(result).toEqual({ drained: 1, remaining: 0, stoppedBy: null })
    expect(builder.upsert).toHaveBeenCalledWith(entry.payload, {
      onConflict: 'id',
    })
  })

  it('keeps legacy entries when the network fails', async () => {
    setOnline(true)
    await db.outbox.add(entry)
    const builder = mockFromResult(null)
    builder.upsert.mockImplementation(() => {
      throw new TypeError('fetch failed')
    })

    const result = await drainLegacyOutbox()

    expect(result).toEqual({ drained: 0, remaining: 1, stoppedBy: 'fetch failed' })
    expect(await db.outbox.get(1)).toMatchObject({
      retryCount: 0,
      status: 'pending',
    })
  })
})
