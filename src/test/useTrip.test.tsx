import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  tripKeys,
  useCreateBooking,
  useCreateChecklistItem,
  useCreateItineraryItem,
  useDeleteBooking,
  useDeleteChecklistItem,
  useDeleteItineraryItem,
  useTripBookings,
  useTripChecklist,
  useTripItinerary,
  useUpdateBooking,
  useUpdateChecklistItem,
  useUpdateItineraryItem,
} from '@/hooks/useTrip'
import { mockFrom, mockFromResult, resetSupabaseMocks } from './mocks/supabase'

vi.mock('@/lib/supabase', async () => {
  const mod = await import('./mocks/supabase')
  return { supabase: mod.supabase }
})

vi.mock('@/lib/offline/outbox', () => ({
  queueWrite: vi.fn(),
}))

const mockQueueWrite = vi.mocked(
  (await import('@/lib/offline/outbox')).queueWrite,
)

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  return { wrapper, queryClient, invalidateSpy }
}

const itineraryItem = {
  id: 'itinerary-1',
  household_id: 'household-1',
  page_id: 'page-1',
  item_date: '2026-08-02',
  start_time: '09:30:00',
  title: 'Ferry to the island',
  notes: null,
  sort_order: 0,
  created_at: '2026-07-11T18:00:00.000Z',
  updated_at: '2026-07-11T18:00:00.000Z',
}

const booking = {
  id: 'booking-1',
  household_id: 'household-1',
  page_id: 'page-1',
  type: 'flight' as const,
  title: 'YVR → HND',
  confirmation_number: 'ABC123',
  address: null,
  starts_at: '2026-08-01T17:00:00.000Z',
  ends_at: null,
  notes: null,
  sort_order: 0,
  created_at: '2026-07-11T18:00:00.000Z',
  updated_at: '2026-07-11T18:00:00.000Z',
}

const checklistItem = {
  id: 'checklist-1',
  household_id: 'household-1',
  page_id: 'page-1',
  label: 'Passports',
  checked: false,
  sort_order: 0,
  created_at: '2026-07-11T18:00:00.000Z',
  updated_at: '2026-07-11T18:00:00.000Z',
}

describe('trip queries', () => {
  beforeEach(resetSupabaseMocks)

  it('loads the itinerary day-ordered with nulls-last start times', async () => {
    const builder = mockFromResult([itineraryItem])
    const { wrapper } = createHarness()
    const { result } = renderHook(() => useTripItinerary('page-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('trip_itinerary_items')
    expect(builder.eq).toHaveBeenCalledWith('page_id', 'page-1')
    expect(builder.order.mock.calls).toEqual([
      ['item_date', { ascending: true }],
      ['start_time', { ascending: true, nullsFirst: false }],
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: true }],
      ['id', { ascending: true }],
    ])
    expect(result.current.data).toEqual([itineraryItem])
  })

  it('loads bookings and checklist in stable sort order and propagates errors', async () => {
    const builder = mockFromResult([booking])
    const { wrapper } = createHarness()
    const bookings = renderHook(() => useTripBookings('page-1'), { wrapper })

    await waitFor(() => expect(bookings.result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('trip_bookings')
    expect(builder.order.mock.calls).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: true }],
      ['id', { ascending: true }],
    ])

    mockFromResult(null, new Error('trip unavailable'))
    const checklist = renderHook(() => useTripChecklist('page-2'), { wrapper })
    await waitFor(() => expect(checklist.result.current.isError).toBe(true))
    expect(checklist.result.current.error).toEqual(
      new Error('trip unavailable'),
    )
  })
})

describe('itinerary mutations', () => {
  beforeEach(resetSupabaseMocks)

  it('creates an idempotent itinerary payload and invalidates the itinerary', async () => {
    const builder = mockFromResult(itineraryItem)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useCreateItineraryItem(), { wrapper })
    result.current.mutate({
      id: 'itinerary-1',
      pageId: 'page-1',
      itemDate: '2026-08-02',
      startTime: '09:30',
      title: 'Ferry to the island',
      notes: null,
      sortOrder: 0,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        id: 'itinerary-1',
        page_id: 'page-1',
        item_date: '2026-08-02',
        start_time: '09:30',
        title: 'Ferry to the island',
        notes: null,
        sort_order: 0,
      },
      { onConflict: 'id' },
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tripKeys.itinerary('page-1'),
    })
  })

  it('updates by both id and page id and propagates mutation errors', async () => {
    const failure = new Error('update denied')
    const builder = mockFromResult(null, failure)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useUpdateItineraryItem(), { wrapper })
    result.current.mutate({
      id: 'itinerary-1',
      pageId: 'page-1',
      itemDate: '2026-08-03',
      startTime: null,
      title: 'Museum day',
      notes: 'Buy tickets ahead',
      sortOrder: 2,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(builder.update).toHaveBeenCalledWith({
      item_date: '2026-08-03',
      start_time: null,
      title: 'Museum day',
      notes: 'Buy tickets ahead',
      sort_order: 2,
    })
    expect(builder.eq.mock.calls).toEqual([
      ['id', 'itinerary-1'],
      ['page_id', 'page-1'],
    ])
    expect(result.current.error).toBe(failure)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('deletes by id and page id and invalidates the itinerary', async () => {
    const builder = mockFromResult(null)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useDeleteItineraryItem(), { wrapper })
    result.current.mutate({ id: 'itinerary-1', pageId: 'page-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq.mock.calls).toEqual([
      ['id', 'itinerary-1'],
      ['page_id', 'page-1'],
    ])
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tripKeys.itinerary('page-1'),
    })
  })
})

describe('booking mutations', () => {
  beforeEach(resetSupabaseMocks)

  it('creates an idempotent booking payload and invalidates bookings', async () => {
    const builder = mockFromResult(booking)
    const { wrapper, invalidateSpy } = createHarness()
    const { result } = renderHook(() => useCreateBooking(), { wrapper })
    result.current.mutate({
      id: 'booking-1',
      pageId: 'page-1',
      type: 'flight',
      title: 'YVR → HND',
      confirmationNumber: 'ABC123',
      address: null,
      startsAt: '2026-08-01T17:00:00.000Z',
      endsAt: null,
      notes: null,
      sortOrder: 0,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        id: 'booking-1',
        page_id: 'page-1',
        type: 'flight',
        title: 'YVR → HND',
        confirmation_number: 'ABC123',
        address: null,
        starts_at: '2026-08-01T17:00:00.000Z',
        ends_at: null,
        notes: null,
        sort_order: 0,
      },
      { onConflict: 'id' },
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tripKeys.bookings('page-1'),
    })
  })

  it('updates and deletes bookings scoped to id plus page id', async () => {
    const updateBuilder = mockFromResult(booking)
    const { wrapper, invalidateSpy } = createHarness()
    const update = renderHook(() => useUpdateBooking(), { wrapper })
    update.result.current.mutate({
      id: 'booking-1',
      pageId: 'page-1',
      type: 'hotel',
      title: 'Shinjuku hotel',
      confirmationNumber: null,
      address: '1-2-3 Nishishinjuku',
      startsAt: null,
      endsAt: null,
      notes: null,
      sortOrder: 1,
    })

    await waitFor(() => expect(update.result.current.isSuccess).toBe(true))
    expect(updateBuilder.update).toHaveBeenCalledWith({
      type: 'hotel',
      title: 'Shinjuku hotel',
      confirmation_number: null,
      address: '1-2-3 Nishishinjuku',
      starts_at: null,
      ends_at: null,
      notes: null,
      sort_order: 1,
    })
    expect(updateBuilder.eq.mock.calls).toEqual([
      ['id', 'booking-1'],
      ['page_id', 'page-1'],
    ])

    const deleteBuilder = mockFromResult(null)
    const remove = renderHook(() => useDeleteBooking(), { wrapper })
    remove.result.current.mutate({ id: 'booking-1', pageId: 'page-1' })

    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true))
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tripKeys.bookings('page-1'),
    })
  })
})

describe('checklist mutations (offline-capable outbox writes)', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    mockQueueWrite.mockReset().mockResolvedValue('synced')
  })

  it('creates via a queued idempotent upsert, patching the cache optimistically', async () => {
    const { wrapper, queryClient, invalidateSpy } = createHarness()
    queryClient.setQueryData(tripKeys.checklist('page-1'), [])
    const { result } = renderHook(() => useCreateChecklistItem(), { wrapper })
    result.current.mutate({
      id: 'checklist-1',
      pageId: 'page-1',
      label: 'Passports',
      sortOrder: 0,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockQueueWrite).toHaveBeenCalledWith({
      clientId: 'checklist-1',
      table: 'trip_checklist_items',
      op: 'upsert',
      payload: {
        id: 'checklist-1',
        page_id: 'page-1',
        label: 'Passports',
        sort_order: 0,
      },
      match: { id: 'checklist-1' },
    })
    expect(
      queryClient.getQueryData<Array<{ id: string }>>(
        tripKeys.checklist('page-1'),
      )?.[0].id,
    ).toBe('checklist-1')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tripKeys.checklist('page-1'),
    })
  })

  it('resolves queued toggles as success without invalidating, keeping the optimistic patch', async () => {
    mockQueueWrite.mockResolvedValue('queued')
    const { wrapper, queryClient, invalidateSpy } = createHarness()
    queryClient.setQueryData(tripKeys.checklist('page-1'), [checklistItem])
    const { result } = renderHook(() => useUpdateChecklistItem(), { wrapper })
    result.current.mutate({ id: 'checklist-1', pageId: 'page-1', checked: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('queued')
    expect(mockQueueWrite).toHaveBeenCalledWith({
      clientId: 'checklist-1',
      table: 'trip_checklist_items',
      op: 'update',
      payload: { checked: true },
      match: { id: 'checklist-1', page_id: 'page-1' },
    })
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(
      queryClient.getQueryData<Array<{ checked: boolean }>>(
        tripKeys.checklist('page-1'),
      )?.[0].checked,
    ).toBe(true)
  })

  it('queues a row-scoped delete and removes the row from the cache', async () => {
    const { wrapper, queryClient } = createHarness()
    queryClient.setQueryData(tripKeys.checklist('page-1'), [checklistItem])
    const { result } = renderHook(() => useDeleteChecklistItem(), { wrapper })
    result.current.mutate({ id: 'checklist-1', pageId: 'page-1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockQueueWrite).toHaveBeenCalledWith({
      clientId: 'checklist-1',
      table: 'trip_checklist_items',
      op: 'delete',
      payload: {},
      match: { id: 'checklist-1', page_id: 'page-1' },
    })
    expect(
      queryClient.getQueryData<unknown[]>(tripKeys.checklist('page-1')),
    ).toHaveLength(0)
  })
})
