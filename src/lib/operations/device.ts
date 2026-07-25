import { db } from '@/lib/db'

const DEVICE_ID_KEY = 'operations.deviceId'
const LOCAL_SEQUENCE_KEY = 'operations.localSequence'

/**
 * Stable per-installation identifier. It survives reloads (IndexedDB) because
 * the server pairs it with the local sequence to order a device's replay; a new
 * id every session would restart that ordering mid-stream.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await db.kv.get(DEVICE_ID_KEY)
  if (typeof existing?.value === 'string') return existing.value

  const deviceId = crypto.randomUUID()
  await db.kv.put({ key: DEVICE_ID_KEY, value: deviceId })
  return deviceId
}

/**
 * Next FIFO position for this device, allocated inside the same transaction
 * that stores the command so two concurrent enqueues cannot share a number.
 */
export async function nextLocalSequence(): Promise<number> {
  return db.transaction('rw', db.kv, async () => {
    const current = await db.kv.get(LOCAL_SEQUENCE_KEY)
    const next = typeof current?.value === 'number' ? current.value + 1 : 1
    await db.kv.put({ key: LOCAL_SEQUENCE_KEY, value: next })
    return next
  })
}

/** Test/reset helper: forget this device's identity and sequence. */
export async function resetDeviceIdentity(): Promise<void> {
  await db.kv.bulkDelete([DEVICE_ID_KEY, LOCAL_SEQUENCE_KEY])
}
