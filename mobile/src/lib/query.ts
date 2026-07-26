import { QueryClient } from '@tanstack/react-query'

/**
 * One shared client. Reads are served from the SQLite query cache and
 * reconciled by Realtime, so the defaults lean on manual invalidation rather
 * than aggressive refetch-on-focus.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}
