import { useState } from 'react'
import type { PageRow } from '@/hooks/usePages'
import {
  tripKeys,
  useDeleteBooking,
  useDeleteChecklistItem,
  useDeleteItineraryItem,
  useTripBookings,
  useTripChecklist,
  useTripItinerary,
  type TripBooking,
  type TripChecklistItem,
  type TripItineraryItem,
} from '@/hooks/useTrip'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeleteDialog } from '@/components/common/DeleteDialog'
import { ItineraryTab } from './ItineraryTab'
import { BookingsTab } from './BookingsTab'
import { ChecklistTab } from './ChecklistTab'
import {
  BookingDialog,
  ChecklistItemDialog,
  ItineraryDialog,
} from './TripDialogs'

const EMPTY_ITINERARY: TripItineraryItem[] = []
const EMPTY_BOOKINGS: TripBooking[] = []
const EMPTY_CHECKLIST: TripChecklistItem[] = []

type DeleteTarget =
  | { kind: 'itinerary'; item: TripItineraryItem }
  | { kind: 'booking'; booking: TripBooking }
  | { kind: 'checklist'; item: TripChecklistItem }
  | null

interface TripPageViewProps {
  page: PageRow
}

export function TripPageView({ page }: TripPageViewProps) {
  const [itineraryDialogOpen, setItineraryDialogOpen] = useState(false)
  const [editingItineraryItem, setEditingItineraryItem] =
    useState<TripItineraryItem | null>(null)
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<TripBooking | null>(null)
  const [editingChecklistItem, setEditingChecklistItem] =
    useState<TripChecklistItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)

  const itineraryQuery = useTripItinerary(page.id)
  const bookingsQuery = useTripBookings(page.id)
  const checklistQuery = useTripChecklist(page.id)
  useRealtimeTable(
    'trip_itinerary_items',
    'page_id',
    page.id,
    tripKeys.itinerary(page.id),
  )
  useRealtimeTable(
    'trip_bookings',
    'page_id',
    page.id,
    tripKeys.bookings(page.id),
  )
  useRealtimeTable(
    'trip_checklist_items',
    'page_id',
    page.id,
    tripKeys.checklist(page.id),
  )
  const deleteItineraryItem = useDeleteItineraryItem()
  const deleteBooking = useDeleteBooking()
  const deleteChecklistItem = useDeleteChecklistItem()

  const itinerary = itineraryQuery.data ?? EMPTY_ITINERARY
  const bookings = bookingsQuery.data ?? EMPTY_BOOKINGS
  const checklist = checklistQuery.data ?? EMPTY_CHECKLIST

  const isPending =
    itineraryQuery.isPending ||
    bookingsQuery.isPending ||
    checklistQuery.isPending
  const isError =
    itineraryQuery.isError || bookingsQuery.isError || checklistQuery.isError

  function openNewItineraryItem() {
    setEditingItineraryItem(null)
    setItineraryDialogOpen(true)
  }

  function openEditItineraryItem(item: TripItineraryItem) {
    setEditingItineraryItem(item)
    setItineraryDialogOpen(true)
  }

  function openNewBooking() {
    setEditingBooking(null)
    setBookingDialogOpen(true)
  }

  function openEditBooking(booking: TripBooking) {
    setEditingBooking(booking)
    setBookingDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'itinerary') {
      await deleteItineraryItem.mutateAsync({
        id: deleteTarget.item.id,
        pageId: page.id,
      })
    } else if (deleteTarget.kind === 'booking') {
      await deleteBooking.mutateAsync({
        id: deleteTarget.booking.id,
        pageId: page.id,
      })
    } else {
      await deleteChecklistItem.mutateAsync({
        id: deleteTarget.item.id,
        pageId: page.id,
      })
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <header>
        <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
          {page.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--meta)]">Trip planner</p>
      </header>

      {isPending ? (
        <p
          role="status"
          className="mt-16 text-center text-sm text-[var(--meta)]"
        >
          Loading trip…
        </p>
      ) : isError ? (
        <div className="mt-12 text-center">
          <p role="alert" className="text-sm text-[var(--danger)]">
            Couldn’t load this trip — check your connection and try again.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => {
              void itineraryQuery.refetch()
              void bookingsQuery.refetch()
              void checklistQuery.refetch()
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="itinerary" className="mt-5">
          <TabsList className="w-full">
            <TabsTrigger value="itinerary" className="flex-1">
              Itinerary
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex-1">
              Bookings
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex-1">
              Checklist
            </TabsTrigger>
          </TabsList>
          <TabsContent value="itinerary" className="mt-4">
            <ItineraryTab
              items={itinerary}
              onAdd={openNewItineraryItem}
              onEdit={openEditItineraryItem}
              onDelete={(item) => setDeleteTarget({ kind: 'itinerary', item })}
            />
          </TabsContent>
          <TabsContent value="bookings" className="mt-4">
            <BookingsTab
              bookings={bookings}
              onAdd={openNewBooking}
              onEdit={openEditBooking}
              onDelete={(booking) =>
                setDeleteTarget({ kind: 'booking', booking })
              }
            />
          </TabsContent>
          <TabsContent value="checklist" className="mt-4">
            <ChecklistTab
              pageId={page.id}
              items={checklist}
              onEdit={setEditingChecklistItem}
              onDelete={(item) => setDeleteTarget({ kind: 'checklist', item })}
            />
          </TabsContent>
        </Tabs>
      )}

      {itineraryDialogOpen && (
        <ItineraryDialog
          key={editingItineraryItem?.id ?? 'new-itinerary-item'}
          open
          onOpenChange={setItineraryDialogOpen}
          pageId={page.id}
          item={editingItineraryItem}
          nextSortOrder={nextSortOrder(itinerary)}
        />
      )}
      {bookingDialogOpen && (
        <BookingDialog
          key={editingBooking?.id ?? 'new-booking'}
          open
          onOpenChange={setBookingDialogOpen}
          pageId={page.id}
          booking={editingBooking}
          nextSortOrder={nextSortOrder(bookings)}
        />
      )}
      {editingChecklistItem && (
        <ChecklistItemDialog
          key={editingChecklistItem.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditingChecklistItem(null)
          }}
          pageId={page.id}
          item={editingChecklistItem}
        />
      )}
      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={
          deleteTarget?.kind === 'booking'
            ? 'Delete booking?'
            : deleteTarget?.kind === 'itinerary'
              ? 'Delete itinerary item?'
              : 'Delete checklist item?'
        }
        description={describeDeleteTarget(deleteTarget)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function describeDeleteTarget(target: DeleteTarget): string {
  if (!target) return ''
  if (target.kind === 'booking') {
    return `“${target.booking.title}” will be permanently deleted.`
  }
  const label = target.kind === 'itinerary' ? target.item.title : target.item.label
  return `“${label}” will be permanently deleted.`
}

function nextSortOrder(rows: Array<{ sort_order: number }>): number {
  return rows.reduce((maximum, row) => Math.max(maximum, row.sort_order + 1), 0)
}
