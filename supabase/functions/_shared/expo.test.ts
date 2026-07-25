import { assertEquals, assertThrows } from 'jsr:@std/assert@1'

import {
  buildMessages,
  chunk,
  EXPO_PUSH_BATCH_SIZE,
  interpretTickets,
  isExpoPushToken,
  pushCopy,
  type PendingNotification,
} from './expo.ts'

const notification = (
  overrides: Partial<PendingNotification> = {},
): PendingNotification => ({
  notificationId: 'notification-1',
  householdId: 'household-1',
  recipientUserId: 'user-1',
  kind: 'calendar.event.created',
  entityType: 'calendar_event',
  entityId: 'event-1',
  payload: { title: 'Dentist' },
  devices: [
    {
      deviceRowId: 'device-1',
      platform: 'ios',
      expoPushToken: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]',
    },
  ],
  ...overrides,
})

Deno.test('activity copy names the event and describes the change', () => {
  assertEquals(pushCopy(notification()), {
    title: 'Dentist',
    body: 'Added to your calendar',
  })
  assertEquals(pushCopy(notification({ kind: 'calendar.event.updated' })), {
    title: 'Dentist',
    body: 'Calendar event updated',
  })
})

Deno.test('deleted-event copy survives the missing title', () => {
  // The trigger stores a null title because the row is already gone.
  assertEquals(
    pushCopy(
      notification({
        kind: 'calendar.event.deleted',
        payload: { title: null },
      }),
    ),
    { title: 'Calendar event removed', body: 'Removed from your calendar' },
  )
})

Deno.test('reminder copy is derived from the stored preset', () => {
  assertEquals(
    pushCopy(
      notification({
        kind: 'calendar.reminder',
        payload: { title: 'Dentist', preset: 'at-time' },
      }),
    ),
    { title: 'Dentist', body: 'Starting now' },
  )
  assertEquals(
    pushCopy(
      notification({
        kind: 'calendar.reminder',
        payload: { title: 'Dentist', preset: '1w' },
      }),
    ),
    { title: 'Dentist', body: 'In 1 week' },
  )
})

Deno.test('an unknown kind still produces a sendable message', () => {
  assertEquals(pushCopy(notification({ kind: 'something.new' })), {
    title: 'Dentist',
    body: 'Household Hub update',
  })
})

Deno.test('one message is built per enabled device', () => {
  const messages = buildMessages([
    notification({
      devices: [
        {
          deviceRowId: 'device-1',
          platform: 'ios',
          expoPushToken: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]',
        },
        {
          deviceRowId: 'device-2',
          platform: 'android',
          expoPushToken: 'ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbb]',
        },
      ],
    }),
  ])

  assertEquals(messages.length, 2)
  assertEquals(messages[0].deviceRowId, 'device-1')
  assertEquals(messages[1].message.to, 'ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbb]')
  assertEquals(messages[0].message.data, {
    notificationId: 'notification-1',
    householdId: 'household-1',
    kind: 'calendar.event.created',
    entityType: 'calendar_event',
    entityId: 'event-1',
  })
})

Deno.test('notifications without devices contribute no messages', () => {
  assertEquals(buildMessages([notification({ devices: null })]), [])
  assertEquals(buildMessages([notification({ devices: [] })]), [])
})

Deno.test('malformed push tokens are never sent to Expo', () => {
  assertEquals(isExpoPushToken('ExponentPushToken[abc]'), true)
  assertEquals(isExpoPushToken('ExpoPushToken[abc]'), true)
  assertEquals(isExpoPushToken('fcm-token-abc'), false)
  assertEquals(isExpoPushToken('ExponentPushToken[]'), false)
  assertEquals(isExpoPushToken(null), false)

  assertEquals(
    buildMessages([
      notification({
        devices: [
          {
            deviceRowId: 'device-1',
            platform: 'ios',
            expoPushToken: 'garbage',
          },
        ],
      }),
    ]),
    [],
  )
})

Deno.test('batches never exceed the Expo request limit', () => {
  const items = Array.from({ length: 250 }, (_, index) => index)
  const batches = chunk(items)

  assertEquals(batches.length, 3)
  assertEquals(batches[0].length, EXPO_PUSH_BATCH_SIZE)
  assertEquals(batches[2].length, 50)
  assertEquals(batches.flat(), items)
})

Deno.test('chunk rejects a nonsensical batch size', () => {
  assertThrows(() => chunk([1, 2, 3], 0))
})

Deno.test('an ok ticket records the receipt for the right device', () => {
  const batch = buildMessages([notification()])
  assertEquals(interpretTickets(batch, [{ status: 'ok', id: 'receipt-1' }]), [
    {
      notificationId: 'notification-1',
      deviceRowId: 'device-1',
      status: 'sent',
      receiptId: 'receipt-1',
      errorCode: null,
      deviceNotRegistered: false,
    },
  ])
})

Deno.test('DeviceNotRegistered marks the device for disabling', () => {
  const batch = buildMessages([notification()])
  const [outcome] = interpretTickets(batch, [
    {
      status: 'error',
      message: 'not registered',
      details: { error: 'DeviceNotRegistered' },
    },
  ])

  assertEquals(outcome.status, 'failed')
  assertEquals(outcome.errorCode, 'DeviceNotRegistered')
  assertEquals(outcome.deviceNotRegistered, true)
})

Deno.test('other Expo errors fail without disabling the device', () => {
  const batch = buildMessages([notification()])
  const [outcome] = interpretTickets(batch, [
    {
      status: 'error',
      message: 'rate limited',
      details: { error: 'MessageRateExceeded' },
    },
  ])

  assertEquals(outcome.errorCode, 'MessageRateExceeded')
  assertEquals(outcome.deviceNotRegistered, false)
})

Deno.test('a short or malformed response fails the unmatched messages', () => {
  const batch = buildMessages([
    notification({
      devices: [
        {
          deviceRowId: 'device-1',
          platform: 'ios',
          expoPushToken: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]',
        },
        {
          deviceRowId: 'device-2',
          platform: 'android',
          expoPushToken: 'ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbb]',
        },
      ],
    }),
  ])

  const outcomes = interpretTickets(batch, [{ status: 'ok', id: 'receipt-1' }])
  assertEquals(outcomes[0].status, 'sent')
  assertEquals(outcomes[1].status, 'failed')
  assertEquals(outcomes[1].errorCode, 'MissingTicket')

  assertEquals(
    interpretTickets(batch, null).map((outcome) => outcome.errorCode),
    ['MissingTicket', 'MissingTicket'],
  )
})
