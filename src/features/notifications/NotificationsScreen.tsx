import { useNavigate } from 'react-router-dom'

import { useActiveHousehold } from '@/features/household'
import { Screen } from '@/shell/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import {
  markNotificationRead,
  notificationCopy,
  useNotifications,
  type InboxNotification,
} from './data'

function relativeTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationsScreen() {
  const navigate = useNavigate()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const query = useNotifications(householdId)

  async function openNotification(notification: InboxNotification) {
    if (householdId && !notification.readAt) {
      await markNotificationRead(householdId, notification)
    }
    if (notification.entityType === 'calendar_event') {
      navigate(`/calendar?event=${encodeURIComponent(notification.entityId)}`)
    }
  }

  return (
    <Screen title="Notifications">
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState
          message="Could not load notifications."
          onRetry={() => void query.refetch()}
        />
      ) : query.data?.length ? (
        <ul className="space-y-2">
          {query.data.map((notification) => {
            const copy = notificationCopy(notification)
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className="flex w-full items-center gap-3 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 text-left shadow-[var(--hh-shadow-card)]"
                >
                  <span
                    aria-hidden
                    className={`size-2 shrink-0 rounded-full ${
                      notification.readAt
                        ? 'bg-transparent'
                        : 'bg-[var(--hh-accent)]'
                    }`}
                  />
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-[var(--hh-ink)] ${
                        notification.readAt ? 'font-semibold' : 'font-extrabold'
                      }`}
                    >
                      {copy.title}
                    </span>
                    <span className="block text-sm text-[var(--hh-muted)]">
                      {copy.body} · {relativeTime(notification.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState
          title="No notifications"
          hint="Partner Calendar activity will appear here."
        />
      )}
    </Screen>
  )
}
