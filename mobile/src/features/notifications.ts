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
  const title =
    typeof payload?.title === 'string' ? payload.title : 'Household Hub'
  switch (notification.kind) {
    case 'calendar.event.created':
      return { title, body: 'Added to your calendar' }
    case 'calendar.event.updated':
      return { title, body: 'Calendar event updated' }
    case 'calendar.event.deleted':
      return {
        title: title === 'Household Hub' ? 'Calendar event removed' : title,
        body: 'Removed from your calendar',
      }
    case 'calendar.reminder':
      return { title, body: 'Upcoming event' }
    default:
      return { title, body: 'Household Hub update' }
  }
}
