import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import { getDeviceId } from '@/lib/operations'
import { supabase } from '@/lib/supabase'
import { registerForPushNotificationsAsync } from './notifications'

type NotificationData = Record<string, unknown>

export function notificationRoute(data: NotificationData):
  | { pathname: '/'; params?: { event: string } }
  | { pathname: '/' } {
  if (
    data.entityType === 'calendar_event' &&
    typeof data.entityId === 'string'
  ) {
    return { pathname: '/', params: { event: data.entityId } }
  }
  return { pathname: '/' }
}

export async function syncPushRegistration(enabled: boolean): Promise<void> {
  const deviceId = await getDeviceId()
  if (!enabled) {
    await supabase.rpc('unregister_notification_device', {
      target_device_id: deviceId,
    })
    return
  }

  const token = await registerForPushNotificationsAsync()
  if (!token || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return
  await supabase.rpc('register_notification_device', {
    target_device_id: deviceId,
    target_platform: Platform.OS,
    target_push_token: token,
  })
}

/**
 * Registers this installation for push and handles both cold-start and live
 * notification taps. The inbox remains the durable source of truth.
 */
export function useNotificationLifecycle(
  enabled: boolean | undefined,
): void {
  const router = useRouter()

  useEffect(() => {
    if (enabled === undefined) return
    void syncPushRegistration(enabled)
  }, [enabled])

  useEffect(() => {
    function open(response: Notifications.NotificationResponse | null) {
      if (!response) return
      const data = response.notification.request.content.data
      router.replace(notificationRoute(data ?? {}))
    }

    void Notifications.getLastNotificationResponseAsync().then(open)
    const subscription =
      Notifications.addNotificationResponseReceivedListener(open)
    return () => subscription.remove()
  }, [router])
}
