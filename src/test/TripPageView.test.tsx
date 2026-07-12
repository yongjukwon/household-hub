import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TripPageView } from '@/components/trips/TripPageView'
import {
  useCreateChecklistItem,
  useDeleteBooking,
  useDeleteChecklistItem,
  useDeleteItineraryItem,
  useTripBookings,
  useTripChecklist,
  useTripItinerary,
  useUpdateChecklistItem,
} from '@/hooks/useTrip'

vi.mock('@/hooks/useTrip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useTrip')>()
  return {
    ...actual,
    useTripItinerary: vi.fn(),
    useTripBookings: vi.fn(),
    useTripChecklist: vi.fn(),
    useDeleteItineraryItem: vi.fn(),
    useDeleteBooking: vi.fn(),
    useDeleteChecklistItem: vi.fn(),
    useCreateItineraryItem: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useUpdateItineraryItem: vi.fn(() => ({
      isPending: false,
      mutateAsync: vi.fn(),
    })),
    useCreateBooking: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
    useUpdateBooking: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
    useCreateChecklistItem: vi.fn(),
    useUpdateChecklistItem: vi.fn(),
  }
})

const mockUseTripItinerary = vi.mocked(useTripItinerary)
const mockUseTripBookings = vi.mocked(useTripBookings)
const mockUseTripChecklist = vi.mocked(useTripChecklist)
const mockUseDeleteItineraryItem = vi.mocked(useDeleteItineraryItem)
const mockUseDeleteBooking = vi.mocked(useDeleteBooking)
const mockUseDeleteChecklistItem = vi.mocked(useDeleteChecklistItem)
const mockUseCreateChecklistItem = vi.mocked(useCreateChecklistItem)
const mockUseUpdateChecklistItem = vi.mocked(useUpdateChecklistItem)

const refetchItinerary = vi.fn()
const refetchBookings = vi.fn()
const refetchChecklist = vi.fn()
const createChecklistItem = vi.fn()
const updateChecklistItem = vi.fn()

const page = {
  id: 'page-1',
  household_id: 'household-1',
  section: 'trip' as const,
  template: 'trip' as const,
  title: 'Tokyo 2026',
  content: { type: 'doc', content: [] },
  created_by: 'user-1',
  archived: false,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

const ferry = {
  id: 'itinerary-ferry',
  household_id: 'household-1',
  page_id: 'page-1',
  item_date: '2026-08-02',
  start_time: '09:30:00',
  title: 'Ferry to the island',
  notes: 'Arrive 20 minutes early',
  sort_order: 0,
  created_at: '2026-07-11T18:00:00.000Z',
  updated_at: '2026-07-11T18:00:00.000Z',
}

const museum = {
  ...ferry,
  id: 'itinerary-museum',
  item_date: '2026-08-03',
  start_time: null,
  title: 'National museum',
  notes: null,
}

const flight = {
  id: 'booking-flight',
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

const hotel = {
  ...flight,
  id: 'booking-hotel',
  type: 'hotel' as const,
  title: 'Shinjuku hotel',
  confirmation_number: null,
  address: '1-2-3 Nishishinjuku',
  starts_at: null,
}

const passports = {
  id: 'checklist-passports',
  household_id: 'household-1',
  page_id: 'page-1',
  label: 'Passports',
  checked: false,
  sort_order: 0,
  created_at: '2026-07-11T18:00:00.000Z',
  updated_at: '2026-07-11T18:00:00.000Z',
}

function queryResult(
  data: unknown,
  options: {
    isPending?: boolean
    isError?: boolean
    refetch?: () => unknown
  } = {},
) {
  return {
    data,
    isPending: options.isPending ?? false,
    isError: options.isError ?? false,
    refetch: options.refetch ?? vi.fn(),
  }
}

function setQueries({
  itinerary = [],
  bookings = [],
  checklist = [],
  itineraryPending = false,
  bookingsError = false,
}: {
  itinerary?: unknown[]
  bookings?: unknown[]
  checklist?: unknown[]
  itineraryPending?: boolean
  bookingsError?: boolean
} = {}) {
  mockUseTripItinerary.mockReturnValue(
    queryResult(itinerary, {
      isPending: itineraryPending,
      refetch: refetchItinerary,
    }) as never,
  )
  mockUseTripBookings.mockReturnValue(
    queryResult(bookings, {
      isError: bookingsError,
      refetch: refetchBookings,
    }) as never,
  )
  mockUseTripChecklist.mockReturnValue(
    queryResult(checklist, { refetch: refetchChecklist }) as never,
  )
}

describe('TripPageView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setQueries()
    mockUseDeleteItineraryItem.mockReturnValue({ mutateAsync: vi.fn() } as never)
    mockUseDeleteBooking.mockReturnValue({ mutateAsync: vi.fn() } as never)
    mockUseDeleteChecklistItem.mockReturnValue({ mutateAsync: vi.fn() } as never)
    mockUseCreateChecklistItem.mockReturnValue({
      isPending: false,
      mutateAsync: createChecklistItem,
    } as never)
    mockUseUpdateChecklistItem.mockReturnValue({
      isPending: false,
      mutate: updateChecklistItem,
      mutateAsync: updateChecklistItem,
    } as never)
  })

  it('renders a named loading state while any trip query is pending', () => {
    setQueries({ itineraryPending: true })
    render(<TripPageView page={page} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading trip…')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('renders a query error and retries all three trip queries', () => {
    setQueries({ bookingsError: true })
    render(<TripPageView page={page} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      /couldn.t load this trip/i,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetchItinerary).toHaveBeenCalledOnce()
    expect(refetchBookings).toHaveBeenCalledOnce()
    expect(refetchChecklist).toHaveBeenCalledOnce()
  })

  it('groups itinerary items by day with times and opens the item dialog', async () => {
    const user = userEvent.setup()
    setQueries({ itinerary: [ferry, museum] })
    render(<TripPageView page={page} />)

    const day1 = screen.getByRole('region', { name: /Aug 2/ })
    expect(within(day1).getByText('Ferry to the island')).toBeInTheDocument()
    expect(within(day1).getByText(/9:30/)).toBeInTheDocument()
    expect(
      within(day1).getByText('Arrive 20 minutes early'),
    ).toBeInTheDocument()
    const day2 = screen.getByRole('region', { name: /Aug 3/ })
    expect(within(day2).getByText('National museum')).toBeInTheDocument()
    expect(within(day2).getByText('—')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add item' }))
    expect(
      screen.getByRole('heading', { name: 'New itinerary item' }),
    ).toBeInTheDocument()
  })

  it('shows empty-tab CTAs that open the create dialogs', async () => {
    const user = userEvent.setup()
    render(<TripPageView page={page} />)

    await user.click(screen.getByRole('button', { name: 'Add itinerary item' }))
    expect(
      screen.getByRole('heading', { name: 'New itinerary item' }),
    ).toBeInTheDocument()
  })

  it('groups bookings by type with confirmation details on the bookings tab', async () => {
    const user = userEvent.setup()
    setQueries({ bookings: [flight, hotel] })
    render(<TripPageView page={page} />)

    await user.click(screen.getByRole('tab', { name: 'Bookings' }))

    const flightGroup = screen.getByRole('region', { name: 'Flight' })
    expect(within(flightGroup).getByText('YVR → HND')).toBeInTheDocument()
    expect(within(flightGroup).getByText('ABC123')).toBeInTheDocument()
    const hotelGroup = screen.getByRole('region', { name: 'Hotel' })
    expect(within(hotelGroup).getByText('Shinjuku hotel')).toBeInTheDocument()
    expect(
      within(hotelGroup).getByText('1-2-3 Nishishinjuku'),
    ).toBeInTheDocument()
  })

  it('adds a checklist item through the inline form with a client-generated id', async () => {
    const user = userEvent.setup()
    createChecklistItem.mockResolvedValue(passports)
    render(<TripPageView page={page} />)

    await user.click(screen.getByRole('tab', { name: 'Checklist' }))
    await user.type(screen.getByLabelText('Add checklist item'), 'Passports')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(createChecklistItem).toHaveBeenCalledWith({
      id: expect.stringMatching(/[0-9a-f-]{36}/),
      pageId: 'page-1',
      label: 'Passports',
      sortOrder: 0,
    })
  })

  it('toggles a checklist item and confirms deletion through the shared dialog', async () => {
    const user = userEvent.setup()
    setQueries({ checklist: [passports] })
    render(<TripPageView page={page} />)

    await user.click(screen.getByRole('tab', { name: 'Checklist' }))
    await user.click(screen.getByRole('checkbox', { name: 'Passports' }))
    expect(updateChecklistItem).toHaveBeenCalledWith(
      { id: 'checklist-passports', pageId: 'page-1', checked: true },
      expect.anything(),
    )

    await user.click(
      screen.getByRole('button', { name: 'Actions for Passports' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(
      screen.getByRole('heading', { name: 'Delete checklist item?' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/permanently deleted/)).toBeInTheDocument()
  })
})
