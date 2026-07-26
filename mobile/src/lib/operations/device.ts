import { deleteSecureItem, getSecureItem, setSecureItem } from '@/lib/secure'
import { newUuid } from '@/lib/uuid'

import { getOperationStore } from './store'

const DEVICE_ID_KEY = 'operations.deviceId'
const LOCAL_SEQUENCE_KEY = 'operations.localSequence'

/**
 * Stable per-installation identifier, kept in the secure store (Keychain /
 * Keystore). It survives relaunches because the server pairs it with the local
 * sequence to order a device's replay; a new id every launch would restart that
 * ordering mid-stream.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await getSecureItem(DEVICE_ID_KEY)
  if (existing) return existing

  const deviceId = newUuid()
  await setSecureItem(DEVICE_ID_KEY, deviceId)
  return deviceId
}

/**
 * Next FIFO position for this device, allocated by the store inside the same
 * transaction that persists the counter, so two concurrent enqueues cannot
 * share a number.
 */
export async function nextLocalSequence(): Promise<number> {
  return getOperationStore().nextSequence(LOCAL_SEQUENCE_KEY)
}

/** Test/reset helper: forget this device's identity. The sequence counter lives
 * in the operation store and is cleared with the rest of it via `store.clear()`. */
export async function resetDeviceIdentity(): Promise<void> {
  await deleteSecureItem(DEVICE_ID_KEY)
}
