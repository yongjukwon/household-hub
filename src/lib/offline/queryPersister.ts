import {
  persistQueryClient,
  type PersistedClient,
  type Persister,
} from '@tanstack/query-persist-client-core'
import type { QueryClient } from '@tanstack/react-query'
import { db } from '@/lib/db'

const CACHE_KEY = 'react-query-cache'

// IndexedDB-backed persister over the shared Dexie instance — offline reads
// come from here (the service worker only caches the static app shell, and
// Realtime websockets can't be cached at all).
const persister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await db.kv.put({ key: CACHE_KEY, value: client })
  },
  restoreClient: async () => {
    const entry = await db.kv.get(CACHE_KEY)
    return entry?.value as PersistedClient | undefined
  },
  removeClient: async () => {
    await db.kv.delete(CACHE_KEY)
  },
}

export function setupQueryPersistence(queryClient: QueryClient) {
  persistQueryClient({
    queryClient,
    persister,
    maxAge: Infinity,
  })
}
