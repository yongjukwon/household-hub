import type { PersistedClient } from '@tanstack/query-persist-client-core'

import type { QueryCacheStore } from './db/sqlite'
import { createQueryPersister } from './queryPersister'

function memoryStore(): QueryCacheStore & { value: string | null } {
  return {
    value: null,
    async get() {
      return this.value
    },
    async set(_key, value) {
      this.value = value
    },
    async remove() {
      this.value = null
    },
  }
}

const client: PersistedClient = {
  timestamp: 1,
  buster: 'mobile-v1',
  clientState: { mutations: [], queries: [] },
}

describe('createQueryPersister', () => {
  it('restores cached queries across client instances', async () => {
    const store = memoryStore()
    await createQueryPersister(store).persistClient(client)

    await expect(createQueryPersister(store).restoreClient()).resolves.toEqual(client)
  })

  it('removes malformed persisted data instead of blocking startup', async () => {
    const store = memoryStore()
    store.value = '{not-json'

    await expect(createQueryPersister(store).restoreClient()).resolves.toBeUndefined()
    expect(store.value).toBeNull()
  })
})
