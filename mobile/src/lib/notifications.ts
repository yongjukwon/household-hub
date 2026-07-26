import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Foreground presentation: partner activity should surface as a banner even
// when the app is open. Badges/sounds are left off for a calm two-person app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

/**
 * Requests notification permission and returns this install's Expo push token,
 * or `null` when unavailable (simulator, or permission denied). The token is
 * what the server's push-dispatch Edge Function (Task 3) sends to; registering
 * it with the backend is a feature concern handled once a household is known.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push tokens are only issued to physical devices.
  if (!Device.isDevice) return null

  const existing = await Notifications.getPermissionsAsync()
  let status = existing.status
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync()
    status = requested.status
  }
  if (status !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  )
  return token.data
}
