import { queryKeys } from '@household-hub/domain'
import { useQuery } from '@tanstack/react-query'

import { enqueueOperation, type EnqueueOutcome } from '@/lib/operations'
import { withOptimisticOverlay } from '@/lib/operations'
import { supabase } from '@/lib/supabase'
import type { Json, Tables } from '@/types/database'

export interface InboxNotification {
  id: string
  actorUserId: string | null
  kind: string
  entityType: string
  entityId: string
  payload: Json
  readAt: string | null
  createdAt: string
  revision: number
}

const CALENDAR_ACTIVITY_KINDS = [
  'calendar.event.created',
  'calendar.event.updated',
  'calendar.event.deleted',
] as const

type CalendarActivityKind = (typeof CALENDAR_ACTIVITY_KINDS)[number]

export function isCalendarActivity(
  notification: InboxNotification,
): notification is InboxNotification & { kind: CalendarActivityKind } {
  return CALENDAR_ACTIVITY_KINDS.includes(
    notification.kind as CalendarActivityKind,
  )
}

export function useNotifications(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId
      ? queryKeys.notifications(householdId)
      : ['notifications', 'off'],
    enabled: !!householdId,
    queryFn: async (): Promise<InboxNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .in('kind', [...CALENDAR_ACTIVITY_KINDS])
        .order('created_at', { ascending: false })
        .returns<Tables<'notifications'>[]>()
      if (error) throw error
      return withOptimisticOverlay((data ?? []).map((row) => ({
        id: row.id,
        actorUserId: row.actor_user_id,
        kind: row.kind,
        entityType: row.entity_type,
        entityId: row.entity_id,
        payload: row.payload,
        readAt: row.read_at,
        createdAt: row.created_at,
        revision: row.revision,
      })), 'notification')
    },
  })
}

export function markNotificationRead(
  householdId: string,
  notification: InboxNotification,
): Promise<EnqueueOutcome> {
  const readAt = new Date().toISOString()
  return enqueueOperation({
    householdId,
    type: 'notification.read',
    entityType: 'notification',
    entityId: notification.id,
    baseRevision: notification.revision,
    payload: { readAt },
    optimistic: { ...notification, readAt },
  })
}

export async function markEventNotificationsRead(
  householdId: string,
  eventId: string,
  notifications: InboxNotification[],
): Promise<void> {
  const unread = notifications.filter(
    (notification) =>
      isCalendarActivity(notification) &&
      notification.entityId === eventId &&
      !notification.readAt,
  )
  for (const notification of unread) {
    await markNotificationRead(householdId, notification)
  }
}

export function removeNotification(
  householdId: string,
  notification: InboxNotification,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'notification.delete',
    entityType: 'notification',
    entityId: notification.id,
    baseRevision: notification.revision,
    payload: {},
    optimistic: null,
  })
}

export function clearNotifications(
  householdId: string,
  recipientUserId: string,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'notification.clear',
    entityType: 'notification',
    entityId: recipientUserId,
    baseRevision: null,
    payload: {},
    optimistic: null,
  })
}

export function scheduleActivityState(notifications: InboxNotification[]): {
  activity: InboxNotification[]
  unreadCount: number
  unreadEventKinds: Map<string, 'New' | 'Updated'>
} {
  const activity = notifications.filter(isCalendarActivity)
  const unread = activity.filter((notification) => !notification.readAt)
  const unreadEventKinds = new Map<string, 'New' | 'Updated'>()
  for (const notification of unread) {
    if (
      unreadEventKinds.has(notification.entityId) ||
      notification.kind === 'calendar.event.deleted'
    ) continue
    unreadEventKinds.set(
      notification.entityId,
      notification.kind === 'calendar.event.created' ? 'New' : 'Updated',
    )
  }
  return { activity, unreadCount: unread.length, unreadEventKinds }
}

function payloadObject(value: Json): Record<string, Json | undefined> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null
}

export function notificationCopy(notification: InboxNotification): {
  title: string
  body: string
} {
  const payload = payloadObject(notification.payload)
  const eventTitle = payloadString(payload, 'title') ?? 'Calendar event'
  const actorName = payloadString(payload, 'actorName') ?? 'Someone'
  const when = activityWhen(payload)
  switch (notification.kind) {
    case 'calendar.event.created':
      return { title: `${actorName} added ${eventTitle}`, body: when }
    case 'calendar.event.updated':
      return { title: `${actorName} updated ${eventTitle}`, body: when }
    case 'calendar.event.deleted':
      return { title: `${actorName} removed ${eventTitle}`, body: when }
    case 'calendar.reminder':
      return { title: eventTitle, body: 'Upcoming event' }
    default:
      return { title: eventTitle, body: 'Household Hub update' }
  }
}

function payloadString(
  payload: Record<string, Json | undefined> | null,
  key: string,
): string | null {
  const value = payload?.[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function activityWhen(
  payload: Record<string, Json | undefined> | null,
): string {
  const allDay = payload?.allDay === true
  const timezone = payloadString(payload, 'timezone') ?? 'UTC'
  const source = allDay
    ? payloadString(payload, 'startDate')
    : payloadString(payload, 'startAt')
  if (!source) return 'Time unavailable'

  const date = allDay ? new Date(`${source}T12:00:00.000Z`) : new Date(source)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  if (allDay) {
    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(date)
    return `${weekday} · All day`
  }
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: timezone,
  }).format(date)
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  })
    .format(date)
    .replace(/\s+/g, ' ')
    .trim()
  return weekday && time ? `${weekday} at ${time}` : 'Time unavailable'
}
