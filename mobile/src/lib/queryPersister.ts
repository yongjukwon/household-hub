import type {
  PersistedClient,
  Persister,
} from '@tanstack/query-persist-client-core'

import {
  createSqliteQueryCacheStore,
  type QueryCacheStore,
} from './db/sqlite'

const QUERY_CACHE_KEY = 'react-query-client'
export const MOBILE_QUERY_CACHE_BUSTER = 'mobile-v2'

/**
 * Stores the dehydrated React Query client in the same durable SQLite
 * database as the offline operation queue. Invalid JSON is removed so a
 * corrupt cache can never prevent the app from starting.
 */
export function createQueryPersister(
  store: QueryCacheStore = createSqliteQueryCacheStore(),
): Persister {
  return {
    async persistClient(client) {
      await store.set(QUERY_CACHE_KEY, JSON.stringify(client))
    },
    async restoreClient(): Promise<PersistedClient | undefined> {
      const value = await store.get(QUERY_CACHE_KEY)
      if (!value) return undefined
      try {
        const client = JSON.parse(value) as PersistedClient
        if (client.buster !== MOBILE_QUERY_CACHE_BUSTER) {
          await store.remove(QUERY_CACHE_KEY)
          return undefined
        }
        return client
      } catch {
        await store.remove(QUERY_CACHE_KEY)
        return undefined
      }
    },
    async removeClient() {
      await store.remove(QUERY_CACHE_KEY)
    },
  }
}
