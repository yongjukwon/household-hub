const mockValues = new Map<string, string>()

jest.mock('@/lib/secure', () => ({
  getSecureItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
  setSecureItem: jest.fn(async (key: string, value: string) => {
    mockValues.set(key, value)
  }),
  deleteSecureItem: jest.fn(async (key: string) => {
    mockValues.delete(key)
  }),
}))

import { secureSessionStorage } from './secureSessionStorage'

beforeEach(() => mockValues.clear())

describe('secureSessionStorage', () => {
  it('persists and removes session values through the secure store', async () => {
    await secureSessionStorage.setItem('session', 'secret')
    await expect(secureSessionStorage.getItem('session')).resolves.toBe('secret')

    await secureSessionStorage.removeItem('session')
    await expect(secureSessionStorage.getItem('session')).resolves.toBeNull()
  })
})
