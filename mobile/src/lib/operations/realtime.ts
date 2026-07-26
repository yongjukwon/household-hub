import { queryKeys } from '@household-hub/domain'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { supabase } from '@/lib/supabase'
import { flushOperations } from './queue'

/**
 * Keeps this client in step with the other member's writes.
 *
 * Every applied operation appends to `household_change_log`, so one
 * household-scoped subscription covers all five features instead of one channel
 * per table. An event invalidates the household's queries; the refetch then
 * goes back through the optimistic overlay, so an incoming change can never
 * erase a command this device has not sent yet.
 *
 * A change also means the connection is alive, which is a good moment to retry
 * anything the queue is holding.
 *
 * Pass an empty `householdId` to skip subscribing (e.g. while it loads).
 */
export function useHouseholdRealtime(householdId: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!householdId) return

    const channel = supabase
      .channel(`household_change_log:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'household_change_log',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.household(householdId),
          })
          void flushOperations()
        },
      )
      .subscribe()

    return () => {
      // removeChannel (not channel.unsubscribe()) — unsubscribing alone leaves
      // the channel in the client's registry and leaks one per mount cycle.
      void supabase.removeChannel(channel)
    }
  }, [householdId, queryClient])
}
