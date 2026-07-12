import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queueWrite } from '@/lib/offline/outbox'
import type {
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/types/database'

export type TripItineraryItem = Tables<'trip_itinerary_items'>
export type TripBooking = Tables<'trip_bookings'>
export type TripChecklistItem = Tables<'trip_checklist_items'>
export type BookingType = Enums<'booking_type'>

export const BOOKING_TYPES: readonly BookingType[] = [
  'flight',
  'hotel',
  'car',
  'other',
]

export const tripKeys = {
  all: ['trip'] as const,
  page: (pageId: string) => ['trip', pageId] as const,
  itinerary: (pageId: string) => ['trip', pageId, 'itinerary'] as const,
  bookings: (pageId: string) => ['trip', pageId, 'bookings'] as const,
  checklist: (pageId: string) => ['trip', pageId, 'checklist'] as const,
}

export function useTripItinerary(pageId: string) {
  return useQuery({
    queryKey: tripKeys.itinerary(pageId),
    enabled: !!pageId,
    queryFn: async (): Promise<TripItineraryItem[]> => {
      const { data, error } = await supabase
        .from('trip_itinerary_items')
        .select('*')
        .eq('page_id', pageId)
        .order('item_date', { ascending: true })
        .order('open_time', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useTripBookings(pageId: string) {
  return useQuery({
    queryKey: tripKeys.bookings(pageId),
    enabled: !!pageId,
    queryFn: async (): Promise<TripBooking[]> => {
      const { data, error } = await supabase
        .from('trip_bookings')
        .select('*')
        .eq('page_id', pageId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useTripChecklist(pageId: string) {
  return useQuery({
    queryKey: tripKeys.checklist(pageId),
    enabled: !!pageId,
    queryFn: async (): Promise<TripChecklistItem[]> => {
      const { data, error } = await supabase
        .from('trip_checklist_items')
        .select('*')
        .eq('page_id', pageId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export interface CreateItineraryItemInput {
  id: string
  pageId: string
  itemDate: string
  openTime: string | null
  closeTime: string | null
  title: string
  notes: string | null
  ticketUrl: string | null
  mapUrl: string | null
  sortOrder: number
}

export type UpdateItineraryItemInput = CreateItineraryItemInput

export function useCreateItineraryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: CreateItineraryItemInput,
    ): Promise<TripItineraryItem> => {
      const row: Omit<TablesInsert<'trip_itinerary_items'>, 'household_id'> = {
        id: input.id,
        page_id: input.pageId,
        item_date: input.itemDate,
        open_time: input.openTime,
        close_time: input.closeTime,
        title: input.title,
        notes: input.notes,
        ticket_url: input.ticketUrl,
        map_url: input.mapUrl,
        sort_order: input.sortOrder,
      }
      // household_id is always overwritten by the database trigger. The
      // generated Insert type cannot express trigger-populated columns.
      const { data, error } = await supabase
        .from('trip_itinerary_items')
        .upsert(row as unknown as TablesInsert<'trip_itinerary_items'>, {
          onConflict: 'id',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: tripKeys.itinerary(input.pageId),
      })
    },
  })
}

export function useUpdateItineraryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: UpdateItineraryItemInput,
    ): Promise<TripItineraryItem> => {
      const updates: TablesUpdate<'trip_itinerary_items'> = {
        item_date: input.itemDate,
        open_time: input.openTime,
        close_time: input.closeTime,
        title: input.title,
        notes: input.notes,
        ticket_url: input.ticketUrl,
        map_url: input.mapUrl,
        sort_order: input.sortOrder,
      }
      const { data, error } = await supabase
        .from('trip_itinerary_items')
        .update(updates)
        .eq('id', input.id)
        .eq('page_id', input.pageId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: tripKeys.itinerary(input.pageId),
      })
    },
  })
}

export interface DeleteTripRowInput {
  id: string
  pageId: string
}

export function useDeleteItineraryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeleteTripRowInput): Promise<void> => {
      const { error } = await supabase
        .from('trip_itinerary_items')
        .delete()
        .eq('id', input.id)
        .eq('page_id', input.pageId)

      if (error) throw error
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: tripKeys.itinerary(input.pageId),
      })
    },
  })
}

export interface CreateBookingInput {
  id: string
  pageId: string
  type: BookingType
  title: string
  confirmationNumber: string | null
  confirmationUrl: string | null
  address: string | null
  startsAt: string | null
  endsAt: string | null
  notes: string | null
  sortOrder: number
}

export type UpdateBookingInput = CreateBookingInput

export function useCreateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateBookingInput): Promise<TripBooking> => {
      const row: Omit<TablesInsert<'trip_bookings'>, 'household_id'> = {
        id: input.id,
        page_id: input.pageId,
        type: input.type,
        title: input.title,
        confirmation_number: input.confirmationNumber,
        confirmation_url: input.confirmationUrl,
        address: input.address,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        notes: input.notes,
        sort_order: input.sortOrder,
      }
      const { data, error } = await supabase
        .from('trip_bookings')
        .upsert(row as unknown as TablesInsert<'trip_bookings'>, {
          onConflict: 'id',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: tripKeys.bookings(input.pageId),
      })
    },
  })
}

export function useUpdateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateBookingInput): Promise<TripBooking> => {
      const updates: TablesUpdate<'trip_bookings'> = {
        type: input.type,
        title: input.title,
        confirmation_number: input.confirmationNumber,
        confirmation_url: input.confirmationUrl,
        address: input.address,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        notes: input.notes,
        sort_order: input.sortOrder,
      }
      const { data, error } = await supabase
        .from('trip_bookings')
        .update(updates)
        .eq('id', input.id)
        .eq('page_id', input.pageId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: tripKeys.bookings(input.pageId),
      })
    },
  })
}

export function useDeleteBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeleteTripRowInput): Promise<void> => {
      const { error } = await supabase
        .from('trip_bookings')
        .delete()
        .eq('id', input.id)
        .eq('page_id', input.pageId)

      if (error) throw error
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: tripKeys.bookings(input.pageId),
      })
    },
  })
}

export interface CreateChecklistItemInput {
  id: string
  pageId: string
  label: string
  sortOrder: number
}

export interface UpdateChecklistItemInput {
  id: string
  pageId: string
  label?: string
  checked?: boolean
}

// Checklist writes are offline-capable (offline-mutation-outbox pattern),
// matching the grocery list: optimistic cache patch with the final
// client-generated id, durable queue-first write, 'queued' resolves as
// success, realtime refreshes server truth after a later flush.

export function useCreateChecklistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: CreateChecklistItemInput,
    ): Promise<'synced' | 'queued'> => {
      const now = new Date().toISOString()
      const optimistic: TripChecklistItem = {
        id: input.id,
        household_id: '',
        page_id: input.pageId,
        label: input.label,
        checked: false,
        sort_order: input.sortOrder,
        created_at: now,
        updated_at: now,
      }
      queryClient.setQueryData<TripChecklistItem[]>(
        tripKeys.checklist(input.pageId),
        (old = []) => [...old, optimistic],
      )
      return queueWrite({
        clientId: input.id,
        table: 'trip_checklist_items',
        op: 'upsert',
        payload: {
          id: input.id,
          page_id: input.pageId,
          label: input.label,
          sort_order: input.sortOrder,
        },
        match: { id: input.id },
      })
    },
    onSuccess: (status, input) => {
      if (status === 'synced') {
        queryClient.invalidateQueries({
          queryKey: tripKeys.checklist(input.pageId),
        })
      }
    },
  })
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: UpdateChecklistItemInput,
    ): Promise<'synced' | 'queued'> => {
      const updates: TablesUpdate<'trip_checklist_items'> = {}
      if (input.label !== undefined) updates.label = input.label
      if (input.checked !== undefined) updates.checked = input.checked
      queryClient.setQueryData<TripChecklistItem[]>(
        tripKeys.checklist(input.pageId),
        (old = []) =>
          old.map((item) =>
            item.id === input.id ? { ...item, ...updates } : item,
          ),
      )
      return queueWrite({
        clientId: input.id,
        table: 'trip_checklist_items',
        op: 'update',
        payload: updates,
        match: { id: input.id, page_id: input.pageId },
      })
    },
    onSuccess: (status, input) => {
      if (status === 'synced') {
        queryClient.invalidateQueries({
          queryKey: tripKeys.checklist(input.pageId),
        })
      }
    },
  })
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: DeleteTripRowInput,
    ): Promise<'synced' | 'queued'> => {
      queryClient.setQueryData<TripChecklistItem[]>(
        tripKeys.checklist(input.pageId),
        (old = []) => old.filter((item) => item.id !== input.id),
      )
      return queueWrite({
        clientId: input.id,
        table: 'trip_checklist_items',
        op: 'delete',
        payload: {},
        match: { id: input.id, page_id: input.pageId },
      })
    },
    onSuccess: (status, input) => {
      if (status === 'synced') {
        queryClient.invalidateQueries({
          queryKey: tripKeys.checklist(input.pageId),
        })
      }
    },
  })
}
