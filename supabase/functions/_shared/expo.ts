// Expo push payload construction, batching, and ticket interpretation.
//
// The network call itself lives in the push-dispatch function; everything that
// decides *what* is sent and *what a response means* is pure so it can be
// tested without an Expo account.

import { describeLead } from './reminders.ts'

/** Expo rejects requests carrying more than 100 messages. */
export const EXPO_PUSH_BATCH_SIZE = 100

export const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'

export type PendingDevice = {
  deviceRowId: string
  platform: string
  expoPushToken: string
}

export type PendingNotification = {
  notificationId: string
  householdId: string
  recipientUserId: string
  kind: string
  entityType: string
  entityId: string
  payload: Record<string, unknown>
  devices: PendingDevice[] | null
}

export type ExpoPushMessage = {
  to: string
  title: string
  body: string
  sound: 'default'
  /** Deep-link routing data consumed by the native notification handler. */
  data: {
    notificationId: string
    householdId: string
    kind: string
    entityType: string
    entityId: string
  }
}

/** One message plus the row it must be recorded against. */
export type AddressedMessage = {
  notificationId: string
  deviceRowId: string
  message: ExpoPushMessage
}

export type ExpoTicket =
  | { status: 'ok'; id: string }
  | {
      status: 'error'
      message: string
      details?: { error?: string }
    }

export type DeliveryOutcome = {
  notificationId: string
  deviceRowId: string
  status: 'sent' | 'failed'
  receiptId: string | null
  errorCode: string | null
  /** Expo says this token is dead; the device row must be disabled. */
  deviceNotRegistered: boolean
}

/**
 * Notification copy. Reminder bodies are built by the reminder scheduler and
 * stored on the payload; activity notifications describe the partner's change.
 */
export function pushCopy(notification: PendingNotification): {
  title: string
  body: string
} {
  const title =
    typeof notification.payload.title === 'string'
      ? notification.payload.title
      : 'Household Hub'

  switch (notification.kind) {
    case 'calendar.reminder': {
      const preset = notification.payload.preset
      if (preset === 'at-time') return { title, body: 'Starting now' }
      if (typeof preset === 'string' && preset !== 'none') {
        return { title, body: `In ${describeLead(preset)}` }
      }
      return { title, body: 'Upcoming event' }
    }
    case 'calendar.event.created':
      return { title, body: 'Added to your calendar' }
    case 'calendar.event.updated':
      return { title, body: 'Calendar event updated' }
    case 'calendar.event.deleted':
      // The row is already gone, so the trigger stores a null title.
      return {
        title:
          typeof notification.payload.title === 'string'
            ? notification.payload.title
            : 'Calendar event removed',
        body: 'Removed from your calendar',
      }
    default:
      return { title, body: 'Household Hub update' }
  }
}

/** One addressed message per (notification, enabled device) pair. */
export function buildMessages(
  notifications: PendingNotification[],
): AddressedMessage[] {
  const messages: AddressedMessage[] = []

  for (const notification of notifications) {
    const { title, body } = pushCopy(notification)

    for (const device of notification.devices ?? []) {
      if (!isExpoPushToken(device.expoPushToken)) continue

      messages.push({
        notificationId: notification.notificationId,
        deviceRowId: device.deviceRowId,
        message: {
          to: device.expoPushToken,
          title,
          body,
          sound: 'default',
          data: {
            notificationId: notification.notificationId,
            householdId: notification.householdId,
            kind: notification.kind,
            entityType: notification.entityType,
            entityId: notification.entityId,
          },
        },
      })
    }
  }

  return messages
}

export function isExpoPushToken(value: unknown): boolean {
  return (
    typeof value === 'string' && /^Expo(nent)?PushToken\[[^\][]+\]$/.test(value)
  )
}

export function chunk<T>(items: T[], size = EXPO_PUSH_BATCH_SIZE): T[][] {
  if (size < 1) throw new Error('Batch size must be at least 1')

  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

/**
 * Pairs a batch with the tickets Expo returned for it. Expo returns tickets
 * positionally; a short or malformed response is treated as a failure for the
 * unmatched messages so they are retried rather than silently dropped.
 */
export function interpretTickets(
  batch: AddressedMessage[],
  tickets: unknown,
): DeliveryOutcome[] {
  const list = Array.isArray(tickets) ? tickets : []

  return batch.map((addressed, index) => {
    const ticket = list[index] as ExpoTicket | undefined

    if (ticket && ticket.status === 'ok' && typeof ticket.id === 'string') {
      return {
        notificationId: addressed.notificationId,
        deviceRowId: addressed.deviceRowId,
        status: 'sent',
        receiptId: ticket.id,
        errorCode: null,
        deviceNotRegistered: false,
      }
    }

    const errorCode =
      ticket && ticket.status === 'error'
        ? (ticket.details?.error ?? 'ExpoError')
        : 'MissingTicket'

    return {
      notificationId: addressed.notificationId,
      deviceRowId: addressed.deviceRowId,
      status: 'failed',
      receiptId: null,
      errorCode,
      deviceNotRegistered: errorCode === 'DeviceNotRegistered',
    }
  })
}
