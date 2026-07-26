import { isUuid } from '@household-hub/domain'

// A per-test in-memory secure store so the device id persists within a test but
// resets between them.
jest.mock('@/lib/secure', () => {
  const store: Record<string, string> = {}
  return {
    getSecureItem: async (k: string) => store[k] ?? null,
    setSecureItem: async (k: string, v: string) => {
      store[k] = v
    },
    deleteSecureItem: async (k: string) => {
      delete store[k]
    },
  }
})

import {
  getDeviceId,
  nextLocalSequence,
  resetDeviceIdentity,
} from './device'
import { InMemoryOperationStore, setOperationStore } from './store'

beforeEach(() => {
  setOperationStore(new InMemoryOperationStore())
})

afterEach(async () => {
  await resetDeviceIdentity()
  setOperationStore(null)
})

describe('device identity', () => {
  it('mints a UUID device id and reuses it across calls', async () => {
    const first = await getDeviceId()
    const second = await getDeviceId()

    expect(isUuid(first)).toBe(true)
    expect(second).toBe(first)
  })

  it('mints a fresh id only after the identity is reset', async () => {
    const first = await getDeviceId()
    await resetDeviceIdentity()
    const second = await getDeviceId()

    expect(second).not.toBe(first)
    expect(isUuid(second)).toBe(true)
  })

  it('allocates a strictly increasing local sequence', async () => {
    expect(await nextLocalSequence()).toBe(1)
    expect(await nextLocalSequence()).toBe(2)
    expect(await nextLocalSequence()).toBe(3)
  })
})
