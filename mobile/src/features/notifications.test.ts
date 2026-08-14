jest.mock('@/lib/operations', () => ({
  enqueueOperation: jest.fn(),
  withOptimisticOverlay: jest.fn(async (rows) => rows),
}))
jest.mock('@/lib/supabase', () => {
  const query: Record<string, jest.Mock> = {}
  query.select = jest.fn(() => query)
  query.eq = jest.fn(() => query)
  query.in = jest.fn(() => query)
  query.order = jest.fn(() => query)
  query.returns = jest.fn()
  return {
    supabase: { from: jest.fn(() => query), __query: query },
  }
})

import { enqueueOperation } from '@/lib/operations'
import { supabase } from '@/lib/supabase'
import {
  clearNotifications,
  fetchNotifications,
  markEventNotificationsRead,
  notificationCopy,
  removeNotification,
  scheduleActivityState,
  type InboxNotification,
} from './notifications'

const mockedFrom = supabase.from as jest.Mock
const mockedQuery = (supabase as unknown as {
  __query: Record<string, jest.Mock>
}).__query
const mockedSelect = mockedQuery.select
const mockedEq = mockedQuery.eq
const mockedIn = mockedQuery.in
const mockedOrder = mockedQuery.order
const mockedReturns = mockedQuery.returns

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'

function activity(
  overrides: Partial<InboxNotification> = {},
): InboxNotification {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    actorUserId: USER,
    kind: 'calendar.event.created',
    entityType: 'calendar_event',
    entityId: '44444444-4444-4444-8444-444444444444',
    payload: {
      actorName: 'Claire',
      title: 'Dinner',
      allDay: false,
      startAt: '2026-08-08T01:00:00.000Z',
      endAt: '2026-08-08T02:00:00.000Z',
      timezone: 'America/Vancouver',
    },
    readAt: null,
    createdAt: '2026-08-07T18:00:00.000Z',
    revision: 1,
    ...overrides,
  }
}

beforeEach(() => {
  ;(enqueueOperation as jest.Mock).mockReset().mockResolvedValue({
    status: 'queued',
    operationId: '55555555-5555-4555-8555-555555555555',
  })
  mockedFrom.mockClear()
  mockedSelect.mockClear()
  mockedEq.mockClear()
  mockedIn.mockClear()
  mockedOrder.mockClear()
  mockedReturns.mockReset().mockResolvedValue({ data: [], error: null })
})

describe('Schedule activity notifications', () => {
  it('scopes activity reads to the active household before filtering kinds', async () => {
    await fetchNotifications(HOUSEHOLD)

    expect(mockedFrom).toHaveBeenCalledWith('notifications')
    expect(mockedEq).toHaveBeenCalledWith('household_id', HOUSEHOLD)
    expect(mockedIn).toHaveBeenCalledWith('kind', [
      'calendar.event.created',
      'calendar.event.updated',
      'calendar.event.deleted',
    ])
  })

  it('uses the snapshotted actor, event title, timezone, and action copy', () => {
    expect(notificationCopy(activity())).toEqual({
      title: 'Claire added Dinner',
      body: 'Friday at 6:00 PM',
    })
    expect(notificationCopy(activity({ kind: 'calendar.event.updated' }))).toEqual({
      title: 'Claire updated Dinner',
      body: 'Friday at 6:00 PM',
    })
    expect(notificationCopy(activity({ kind: 'calendar.event.deleted' }))).toEqual({
      title: 'Claire removed Dinner',
      body: 'Friday at 6:00 PM',
    })
  })

  it('excludes reminders and derives unread counts, event badges, and red-dot event ids', () => {
    const reminder = activity({
      id: '55555555-5555-4555-8555-555555555555',
      kind: 'calendar.reminder',
    })
    const updated = activity({
      id: '66666666-6666-4666-8666-666666666666',
      kind: 'calendar.event.updated',
      entityId: '77777777-7777-4777-8777-777777777777',
    })
    const read = activity({
      id: '88888888-8888-4888-8888-888888888888',
      readAt: '2026-08-08T03:00:00.000Z',
    })

    expect(scheduleActivityState([reminder, updated, read])).toEqual({
      activity: [updated, read],
      unreadCount: 1,
      unreadEventKinds: new Map([
        ['77777777-7777-4777-8777-777777777777', 'Updated'],
      ]),
    })
  })

  it('queues one durable read for every unread activity row for an opened event', async () => {
    const first = activity()
    const second = activity({
      id: '66666666-6666-4666-8666-666666666666',
      kind: 'calendar.event.updated',
      revision: 2,
    })
    const read = activity({
      id: '77777777-7777-4777-8777-777777777777',
      readAt: '2026-08-08T03:00:00.000Z',
    })

    await markEventNotificationsRead(HOUSEHOLD, first.entityId, [first, second, read])

    expect(enqueueOperation).toHaveBeenCalledTimes(2)
    expect(enqueueOperation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'notification.read',
        entityId: first.id,
        baseRevision: 1,
      }),
    )
  })

  it('queues durable individual Remove and recipient-scoped Clear all operations', async () => {
    const notification = activity()

    await removeNotification(HOUSEHOLD, notification)
    await clearNotifications(HOUSEHOLD, USER)

    expect(enqueueOperation).toHaveBeenNthCalledWith(1, {
      householdId: HOUSEHOLD,
      type: 'notification.delete',
      entityType: 'notification',
      entityId: notification.id,
      baseRevision: notification.revision,
      payload: {},
      optimistic: null,
    })
    expect(enqueueOperation).toHaveBeenNthCalledWith(2, {
      householdId: HOUSEHOLD,
      type: 'notification.clear',
      entityType: 'notification',
      entityId: USER,
      baseRevision: null,
      payload: {},
      optimistic: null,
    })
  })
})
