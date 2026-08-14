import { fireEvent, render, waitFor } from '@testing-library/react-native'
import CalendarScreen from './index'
import type { InboxNotification } from '@/features/notifications'

const EVENT_ID = '44444444-4444-4444-8444-444444444444'
const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111'
const mockedSetParams = jest.fn()
const mockedMarkEventRead = jest.fn()
let mockedParams: { event?: string } = {}
let mockedNotifications: InboxNotification[] = []

const mockedEvent = {
  id: EVENT_ID,
  title: 'Dinner',
  note: null,
  ownerId: null,
  allDay: true,
  timeZone: 'UTC',
  startsAt: null,
  endsAt: null,
  startDate: '2026-08-13',
  endDate: '2026-08-13',
  recurrenceFrequency: 'none' as const,
  recurrenceUntil: null,
  reminders: [],
  revision: 1,
}

const activity: InboxNotification = {
  id: '33333333-3333-4333-8333-333333333333',
  actorUserId: '22222222-2222-4222-8222-222222222222',
  kind: 'calendar.event.updated',
  entityType: 'calendar_event',
  entityId: EVENT_ID,
  payload: {
    actorName: 'Claire',
    title: 'Dinner',
    allDay: true,
    startDate: '2026-08-13',
    endDate: '2026-08-13',
    timezone: 'UTC',
  },
  readAt: null,
  createdAt: '2026-08-13T18:00:00.000Z',
  revision: 1,
}

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockedParams,
  useRouter: () => ({ setParams: mockedSetParams }),
}))
jest.mock('@/components/AppChrome', () => ({ useAppChrome: jest.fn() }))
jest.mock('@/components/Card', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { Card: (props: { children: React.ReactNode }) => React.createElement(View, null, props.children) }
})
jest.mock('@/components/ListCard', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { ListCard: (props: { children: React.ReactNode }) => React.createElement(View, null, props.children) }
})
jest.mock('@/components/states', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    EmptyState: (props: { title: string }) => React.createElement(Text, null, props.title),
    ErrorState: (props: { message: string }) => React.createElement(Text, null, props.message),
    LoadingState: () => React.createElement(Text, null, 'Loading'),
  }
})
jest.mock('@/features/calendar/EventSheet', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    EventSheet: (props: { open: boolean }) => React.createElement(View, {
      testID: 'event-sheet',
      accessibilityState: { expanded: props.open },
    }),
  }
})
jest.mock('@/features/calendar/useCalendarEvents', () => ({
  useCalendarEvents: () => ({ data: [mockedEvent], isLoading: false, isError: false }),
}))
jest.mock('@/features/household', () => ({
  deviceTimeZone: () => 'UTC',
  useActiveHousehold: () => ({
    data: { id: '11111111-1111-4111-8111-111111111111', members: [] },
    isError: false,
  }),
}))
jest.mock('@/features/notifications', () => {
  const actual = jest.requireActual('@/features/notifications')
  return {
    ...actual,
    useNotifications: () => ({ data: mockedNotifications }),
    markEventNotificationsRead: (...args: unknown[]) => mockedMarkEventRead(...args),
  }
})
jest.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } }),
}))
jest.mock('@/theme/tokens', () => {
  const actual = jest.requireActual('@/theme/tokens')
  return { ...actual, useTheme: () => ({ tokens: actual.lightTokens, scheme: 'light' }) }
})

beforeEach(() => {
  mockedParams = {}
  mockedNotifications = [activity]
  mockedMarkEventRead.mockReset().mockResolvedValue(undefined)
  mockedSetParams.mockReset()
  jest.useFakeTimers().setSystemTime(new Date('2026-08-13T12:00:00.000Z'))
})

afterEach(() => {
  jest.useRealTimers()
})

it('marks all event activity read when an event row is opened directly', async () => {
  const view = await render(<CalendarScreen />)

  await fireEvent.press(view.getByText('Dinner'))

  expect(mockedMarkEventRead).toHaveBeenCalledWith(
    HOUSEHOLD_ID,
    EVENT_ID,
    [activity],
  )
})

it('marks all event activity read when an OS/deep-link event opens', async () => {
  mockedParams = { event: EVENT_ID }
  const view = await render(<CalendarScreen />)

  await waitFor(() => {
    expect(mockedMarkEventRead).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      EVENT_ID,
      [activity],
    )
  })
  expect(view.getByTestId('event-sheet').props.accessibilityState).toEqual({
    expanded: true,
  })
})

it('renders and clears the unread red calendar dot and Updated event badge', async () => {
  const view = await render(<CalendarScreen />)

  expect(view.getByTestId('calendar-unread-dot-2026-08-13')).toBeTruthy()
  expect(view.getByLabelText('Updated')).toBeTruthy()

  mockedNotifications = [{ ...activity, readAt: '2026-08-13T19:00:00.000Z' }]
  await view.rerender(<CalendarScreen />)

  await waitFor(() => {
    expect(view.queryByTestId('calendar-unread-dot-2026-08-13')).toBeNull()
    expect(view.queryByLabelText('Updated')).toBeNull()
  })
})
