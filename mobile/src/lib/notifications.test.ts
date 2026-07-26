let mockIsDevice = true
jest.mock('expo-device', () => ({
  __esModule: true,
  get isDevice() {
    return mockIsDevice
  },
}))
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } },
}))
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}))

import * as Notifications from 'expo-notifications'

import { registerForPushNotificationsAsync } from './notifications'

const mocked = Notifications as jest.Mocked<typeof Notifications>

beforeEach(() => {
  jest.clearAllMocks()
  mockIsDevice = true
  mocked.getExpoPushTokenAsync.mockResolvedValue({
    data: 'ExponentPushToken[abc]',
  } as never)
})

describe('registerForPushNotificationsAsync', () => {
  it('returns null on a simulator (no physical device)', async () => {
    mockIsDevice = false

    expect(await registerForPushNotificationsAsync()).toBeNull()
    expect(mocked.getExpoPushTokenAsync).not.toHaveBeenCalled()
  })

  it('returns null when permission is denied', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as never)
    mocked.requestPermissionsAsync.mockResolvedValue({
      status: 'denied',
    } as never)

    expect(await registerForPushNotificationsAsync()).toBeNull()
    expect(mocked.getExpoPushTokenAsync).not.toHaveBeenCalled()
  })

  it('requests permission and returns the Expo push token when granted', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({
      status: 'undetermined',
    } as never)
    mocked.requestPermissionsAsync.mockResolvedValue({
      status: 'granted',
    } as never)

    const token = await registerForPushNotificationsAsync()

    expect(token).toBe('ExponentPushToken[abc]')
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(mocked.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'proj-1',
    })
  })

  it('does not re-prompt when permission is already granted', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never)

    const token = await registerForPushNotificationsAsync()

    expect(token).toBe('ExponentPushToken[abc]')
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled()
  })
})
