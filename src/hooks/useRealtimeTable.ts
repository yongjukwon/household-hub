import { useEffect } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Keeps a React Query cache entry live while another client changes the
 * underlying rows: subscribes a postgres_changes channel scoped exactly as
 * narrowly as the query it backs and invalidates `queryKey` on any event.
 *
 * Pass an empty `filterValue` to skip subscribing (e.g. while the household
 * id is still loading).
 *
 * Note: DELETE events only pass column filters because every app table has
 * REPLICA IDENTITY FULL (see the realtime migration) — without it the old
 * record carries only the primary key and filtered deletes are silently
 * dropped, leaving the other client's cache stale.
 */
export function useRealtimeTable(
  table: string,
  filterColumn: string,
  filterValue: string,
  queryKey: QueryKey,
) {
  const queryClient = useQueryClient()
  // Callers build queryKey as an inline array literal (new reference every
  // render); depending on the stringified contents keeps the channel stable
  // across re-renders while the effect body closes over the real array.
  const queryKeyDep = JSON.stringify(queryKey)

  useEffect(() => {
    if (!filterValue) return

    const channel = supabase
      .channel(`${table}:${filterColumn}:${filterValue}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe()

    return () => {
      // removeChannel (not channel.unsubscribe()) — unsubscribing alone
      // leaves the channel in the client's registry and leaks one channel
      // per mount/unmount cycle.
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKeyDep stands in for queryKey (see above)
  }, [table, filterColumn, filterValue, queryKeyDep, queryClient])
}
