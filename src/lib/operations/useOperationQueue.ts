import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'

import { db } from '@/lib/db'
import type { DiscardedOperation } from './types'

export interface OperationQueueStatus {
  /** Commands still waiting to reach the server. */
  pending: number
  /** Discarded commands the user has not dismissed. */
  discarded: number
  /** Why the last replay stopped, if it did. */
  lastError: string | null
}

/** Live queue counters for the shell's sync indicator. */
export function useOperationQueueStatus(): OperationQueueStatus {
  const [status, setStatus] = useState<OperationQueueStatus>({
    pending: 0,
    discarded: 0,
    lastError: null,
  })

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [queued, discards] = await Promise.all([
        db.operations.orderBy('localSequence').toArray(),
        db.discardedOperations.toArray(),
      ])

      return {
        pending: queued.length,
        discarded: discards.filter((record) => record.acknowledgedAt === null)
          .length,
        lastError: queued.find((entry) => entry.lastError)?.lastError ?? null,
      }
    }).subscribe({
      next: setStatus,
      error: (error) => console.error('Operation queue status failed', error),
    })

    return () => subscription.unsubscribe()
  }, [])

  return status
}

/** Live list of discards awaiting acknowledgement, newest first. */
export function useDiscardedOperations(): DiscardedOperation[] {
  const [records, setRecords] = useState<DiscardedOperation[]>([])

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const all = await db.discardedOperations.toArray()
      return all
        .filter((record) => record.acknowledgedAt === null)
        .sort((a, b) => b.discardedAt.localeCompare(a.discardedAt))
    }).subscribe({
      next: setRecords,
      error: (error) =>
        console.error('Discarded operations query failed', error),
    })

    return () => subscription.unsubscribe()
  }, [])

  return records
}
