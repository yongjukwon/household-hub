import { Slot, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProfile } from '@/features/settings/profile'
import { useActiveHousehold } from '@/features/household'
import { ScheduleActivityPopover } from '@/features/ScheduleActivityPopover'
import {
  clearNotifications,
  markNotificationRead,
  removeNotification,
  scheduleActivityState,
  useNotifications,
  type InboxNotification,
} from '@/features/notifications'
import { useAuth } from '@/lib/auth/AuthContext'

import { AppHeader } from '@/components/AppHeader'
import { AppChromeProvider } from '@/components/AppChromeProvider'
import { GradientBackground } from '@/components/GradientBackground'
import {
  FloatingTabBar,
  TAB_BAR_FLOAT_OFFSET,
  TAB_BAR_HEIGHT,
} from '@/components/FloatingTabBar'

/**
 * Five primary destinations, Calendar first and default (`index`). Renders
 * the persistent header and floating tab bar as chrome around whichever route
 * is active — a custom layout (not expo-router's built-in `<Tabs>` bar)
 * because the design reference's floating pill and title-less header don't
 * map onto the native tab bar's header/label conventions.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const profile = useProfile()
  const router = useRouter()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const notifications = useNotifications(householdId)
  const { session } = useAuth()
  const [activityOpen, setActivityOpen] = useState(false)
  const activityState = useMemo(
    () => scheduleActivityState(notifications.data ?? []),
    [notifications.data],
  )

  function openActivity(notification: InboxNotification, navigate: boolean) {
    if (householdId && !notification.readAt) {
      void markNotificationRead(householdId, notification)
    }
    setActivityOpen(false)
    if (navigate) {
      router.replace({ pathname: '/', params: { event: notification.entityId } })
    }
  }

  return (
    <View style={styles.root}>
      <GradientBackground />
      <AppChromeProvider>
        <AppHeader
          hasUnreadActivity={activityState.unreadCount > 0}
          onNotificationsPress={() => setActivityOpen((open) => !open)}
        />
        <View
          style={[
            styles.content,
            { paddingBottom: insets.bottom + TAB_BAR_FLOAT_OFFSET + TAB_BAR_HEIGHT + 12 },
          ]}
        >
          <Slot />
        </View>
        <FloatingTabBar
          navigation={profile.data?.mobileNavigation}
          hasUnreadScheduleActivity={activityState.unreadCount > 0}
        />
        <ScheduleActivityPopover
          open={activityOpen}
          topInset={insets.top}
          notifications={activityState.activity}
          loading={notifications.isLoading}
          error={notifications.isError}
          onRetry={() => void notifications.refetch()}
          onOpenChange={setActivityOpen}
          onOpenActivity={openActivity}
          onRemove={(notification) => {
            if (householdId) void removeNotification(householdId, notification)
          }}
          onClear={() => {
            const userId = session?.user.id
            if (householdId && userId) void clearNotifications(householdId, userId)
          }}
        />
      </AppChromeProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
})
