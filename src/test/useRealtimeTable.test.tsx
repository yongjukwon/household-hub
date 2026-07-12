import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
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

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  return { wrapper, invalidateSpy }
}

describe('useRealtimeTable', () => {
  beforeEach(resetSupabaseMocks)

  it('subscribes a page-scoped channel and invalidates the query key on events', () => {
    const { wrapper, invalidateSpy } = createHarness()
    renderHook(
      () =>
        useRealtimeTable('grocery_items', 'page_id', 'page-1', [
          'grocery',
          'page-1',
          'items',
        ]),
      { wrapper },
    )

    expect(mockChannel).toHaveBeenCalledWith('grocery_items:page_id:page-1')
    const channel = mockChannel.mock.results[0].value as ChannelMock
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'grocery_items',
        filter: 'page_id=eq.page-1',
      },
      expect.any(Function),
    )
    expect(channel.subscribe).toHaveBeenCalledOnce()

    channel.handlers[0].callback({ eventType: 'INSERT' })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['grocery', 'page-1', 'items'],
    })
  })

  it('removes the channel (not just unsubscribes) on unmount', () => {
    const { wrapper } = createHarness()
    const { unmount } = renderHook(
      () => useRealtimeTable('pages', 'id', 'page-1', ['page', 'page-1']),
      { wrapper },
    )

    const channel = mockChannel.mock.results[0].value as ChannelMock
    expect(mockRemoveChannel).not.toHaveBeenCalled()
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledWith(channel)
  })

  it('keeps one stable channel across re-renders despite inline-array query keys', () => {
    const { wrapper } = createHarness()
    const { rerender } = renderHook(
      // A fresh array literal every render — the classic churn trap.
      () => useRealtimeTable('pages', 'id', 'page-1', ['page', 'page-1']),
      { wrapper },
    )

    rerender()
    rerender()
    expect(mockChannel).toHaveBeenCalledOnce()
    expect(mockRemoveChannel).not.toHaveBeenCalled()
  })

  it('resubscribes when the filter value changes', () => {
    const { wrapper } = createHarness()
    const { rerender } = renderHook(
      ({ pageId }: { pageId: string }) =>
        useRealtimeTable('pages', 'id', pageId, ['page', pageId]),
      { wrapper, initialProps: { pageId: 'page-1' } },
    )

    rerender({ pageId: 'page-2' })
    expect(mockChannel).toHaveBeenCalledTimes(2)
    expect(mockChannel).toHaveBeenLastCalledWith('pages:id:page-2')
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
  })

  it('does not subscribe while the filter value is empty', () => {
    const { wrapper } = createHarness()
    const { rerender } = renderHook(
      ({ householdId }: { householdId: string }) =>
        useRealtimeTable('pages', 'household_id', householdId, ['pages']),
      { wrapper, initialProps: { householdId: '' } },
    )

    expect(mockChannel).not.toHaveBeenCalled()
    rerender({ householdId: 'household-1' })
    expect(mockChannel).toHaveBeenCalledWith('pages:household_id:household-1')
  })
})
