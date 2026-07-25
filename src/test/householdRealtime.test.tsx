import 'fake-indexeddb/auto'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { db } from '@/lib/db'
import {
  enqueueOperation,
  resetDeviceIdentity,
  useHouseholdRealtime,
  withOptimisticOverlay,
  type EnqueueInput,
} from '@/lib/operations'
import {
  mockChannel,
  mockRemoveChannel,
  resetSupabaseMocks,
  type ChannelMock,
} from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111'
const EVENT_A = '22222222-2222-4222-8222-222222222222'

const upsertEvent = (overrides: Partial<EnqueueInput> = {}): EnqueueInput => ({
  householdId: HOUSEHOLD,
  type: 'calendar.event.upsert',
  entityType: 'calendar_event',
  entityId: EVENT_A,
  baseRevision: null,
  payload: { title: 'Mine' },
  optimistic: { title: 'Mine' },
  ...overrides,
})

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

describe('useHouseholdRealtime', () => {
  let client: QueryClient

  beforeEach(async () => {
    resetSupabaseMocks()
    await db.operations.clear()
    await resetDeviceIdentity()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    client.clear()
  })

  it('subscribes to the household change log, not to every table', () => {
    renderHook(() => useHouseholdRealtime(HOUSEHOLD), {
      wrapper: wrapper(client),
    })

    expect(mockChannel).toHaveBeenCalledTimes(1)
    const channel = mockChannel.mock.results[0].value as ChannelMock
    expect(channel.handlers[0].config).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'household_change_log',
      filter: `household_id=eq.${HOUSEHOLD}`,
    })
  })

  it('does not subscribe until the household id is known', () => {
    renderHook(() => useHouseholdRealtime(''), { wrapper: wrapper(client) })
    expect(mockChannel).not.toHaveBeenCalled()
  })

  it('invalidates the household queries when the partner writes', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    renderHook(() => useHouseholdRealtime(HOUSEHOLD), {
      wrapper: wrapper(client),
    })

    const channel = mockChannel.mock.results[0].value as ChannelMock
    channel.handlers[0].callback({ eventType: 'INSERT' })

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['household', HOUSEHOLD],
      }),
    )
  })

  it("a partner's change does not erase this device's unsent edit", async () => {
    await enqueueOperation(upsertEvent())

    renderHook(() => useHouseholdRealtime(HOUSEHOLD), {
      wrapper: wrapper(client),
    })
    const channel = mockChannel.mock.results[0].value as ChannelMock
    channel.handlers[0].callback({ eventType: 'INSERT' })

    // What the invalidated query refetches: the partner's version.
    const refetched = [{ id: EVENT_A, title: 'Theirs' }]
    expect(await withOptimisticOverlay(refetched, 'calendar_event')).toEqual([
      { id: EVENT_A, title: 'Mine' },
    ])
  })

  it('removes the channel on unmount instead of leaking it', () => {
    const { unmount } = renderHook(() => useHouseholdRealtime(HOUSEHOLD), {
      wrapper: wrapper(client),
    })
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
  })
})
