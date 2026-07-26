jest.mock('expo-router', () => ({ useRouter: jest.fn() }))
jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}))
jest.mock('@/lib/operations', () => ({ getDeviceId: jest.fn() }))
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }))
jest.mock('./notifications', () => ({
  registerForPushNotificationsAsync: jest.fn(),
}))

import { getDeviceId } from '@/lib/operations'
import { supabase } from '@/lib/supabase'
import { registerForPushNotificationsAsync } from './notifications'
import {
  notificationRoute,
  syncPushRegistration,
} from './notificationLifecycle'

describe('notification lifecycle', () => {
  it('deep-links Calendar activity to the matching event', () => {
    expect(
      notificationRoute({
        entityType: 'calendar_event',
        entityId: 'event-1',
      }),
    ).toEqual({ pathname: '/', params: { event: 'event-1' } })
  })

  it('registers the device token with the server', async () => {
    ;(getDeviceId as jest.Mock).mockResolvedValue(
      '20000000-0000-4000-8000-000000000001',
    )
    ;(registerForPushNotificationsAsync as jest.Mock).mockResolvedValue(
      'ExponentPushToken[abc]',
    )

    await syncPushRegistration(true)

    expect(supabase.rpc).toHaveBeenCalledWith(
      'register_notification_device',
      expect.objectContaining({
        target_device_id: '20000000-0000-4000-8000-000000000001',
        target_push_token: 'ExponentPushToken[abc]',
      }),
    )
  })
})
