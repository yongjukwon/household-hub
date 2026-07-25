import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isUuid, type UUID } from '@household-hub/domain'
import { CalendarScreen } from '@/features/calendar/CalendarScreen'
import { useActiveHousehold } from '@/features/household'
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents'
import type { CalendarEventItem } from '@/features/calendar/events'
import { saveCalendarEvent } from '@/features/calendar/mutations'
import type { EnqueueOutcome } from '@/lib/operations'

vi.mock('@/features/household', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/household')>()
  return {
    ...actual,
    useActiveHousehold: vi.fn(),
    // Pin the device timezone so date placement is deterministic.
    deviceTimeZone: () => 'America/Toronto',
  }
})
vi.mock('@/features/calendar/useCalendarEvents', () => ({
  useCalendarEvents: vi.fn(),
}))
vi.mock('@/features/calendar/mutations', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/calendar/mutations')>()
  return {
    ...actual,
    saveCalendarEvent: vi.fn(),
  }
})

const mockHousehold = vi.mocked(useActiveHousehold)
const mockEvents = vi.mocked(useCalendarEvents)
const mockSaveEvent = vi.mocked(saveCalendarEvent)

function uuid(value: string): UUID {
  if (!isUuid(value)) throw new Error(`not a UUID: ${value}`)
  return value
}

const OPERATION_ID = uuid('55555555-5555-4555-8555-555555555555')

function timedEvent(over: Partial<CalendarEventItem>): CalendarEventItem {
  return {
    id: 'evt-1',
    title: 'Dentist',
    note: null,
    ownerId: null,
    allDay: false,
    timeZone: 'America/Toronto',
    startsAt: '2026-07-15T18:30:00.000Z', // 2:30 PM Toronto
    endsAt: '2026-07-15T19:30:00.000Z',
    startDate: null,
    endDate: null,
    recurrenceFrequency: 'none',
    recurrenceUntil: null,
    reminders: [],
    revision: 1,
    ...over,
  }
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-07-10T15:00:00Z'))
  mockSaveEvent.mockResolvedValue({
    status: 'queued',
    operationId: OPERATION_ID,
  })
  mockHousehold.mockReturnValue({
    data: { id: '11111111-1111-1111-1111-111111111111', name: 'Home', members: [] },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  mockEvents.mockReturnValue({
    data: [timedEvent({})],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCalendarEvents>)
})

function renderScreen() {
  return render(
    <MemoryRouter>
      <CalendarScreen />
    </MemoryRouter>,
  )
}

describe('CalendarScreen', () => {
  it('renders the current month grid and title', () => {
    renderScreen()
    expect(screen.getByText('July 2026')).toBeInTheDocument()
    // 42 day cells (labelled by their date key).
    expect(screen.getByLabelText('2026-07-15')).toBeInTheDocument()
  })

  it('shows the selected day heading and its events after selecting a day', async () => {
    renderScreen()
    await userEvent.click(screen.getByLabelText('2026-07-15'))
    expect(screen.getByText('Wednesday, July 15')).toBeInTheDocument()
    expect(screen.getByText('Dentist')).toBeInTheDocument()
    // Toronto local start time.
    expect(screen.getByText('2:30 PM')).toBeInTheDocument()
  })

  it('shows an empty state for a day with no events', async () => {
    renderScreen()
    await userEvent.click(screen.getByLabelText('2026-07-20'))
    expect(screen.getByText('Nothing planned')).toBeInTheDocument()
  })

  it('advances to the next month', async () => {
    renderScreen()
    await userEvent.click(screen.getByLabelText('Next month'))
    expect(screen.getByText('August 2026')).toBeInTheDocument()
  })

  it('opens the new-event sheet from the add button', async () => {
    renderScreen()
    await userEvent.click(screen.getByLabelText('New event'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('New event')).toBeInTheDocument()
  })

  it('keeps the event sheet open when the server discards the save', async () => {
    const discarded: EnqueueOutcome = {
      status: 'discarded',
      operationId: OPERATION_ID,
      discarded: {
        operationId: OPERATION_ID,
        reason: 'rejected',
        command: {
          schemaVersion: 1,
          operationId: OPERATION_ID,
          deviceId: uuid('66666666-6666-4666-8666-666666666666'),
          localSequence: 1,
          householdId: uuid('11111111-1111-4111-8111-111111111111'),
          type: 'calendar.event.upsert',
          entityType: 'calendar_event',
          entityId: uuid('77777777-7777-4777-8777-777777777777'),
          baseRevision: null,
          enqueuedAt: '2026-07-25T12:00:00.000Z',
          payload: {},
        },
        discardedAt: '2026-07-25T12:00:01.000Z',
        winner: null,
        code: 'invalid_payload',
        explanation: 'Operation payload is invalid for its type',
        details: {},
        warnings: [],
        acknowledgedAt: null,
      },
    }
    mockSaveEvent.mockResolvedValueOnce(discarded)

    renderScreen()
    await userEvent.click(screen.getByLabelText('New event'))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Dinner')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(
      await within(dialog).findByText(
        'Operation payload is invalid for its type',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes the event sheet after the save is durably queued', async () => {
    renderScreen()
    await userEvent.click(screen.getByLabelText('New event'))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Dinner')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
