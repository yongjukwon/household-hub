import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { performOutboxOp } from './outbox'

const MAX_RETRIES = 5
const FLUSH_INTERVAL_MS = 30_000

let flushInFlight = false

/**
 * Replays pending outbox entries in creation order. A network-level throw
 * (fetch failed — effectively still offline) aborts the pass without
 * penalizing entries; a server rejection (constraint violation etc.)
 * increments retryCount and flips the entry to 'failed' at the cap so a
 * permanently-broken row surfaces in the UI instead of retrying forever.
 */
export async function flushOutbox(): Promise<void> {
  if (flushInFlight || !navigator.onLine) return
  flushInFlight = true
  try {
    const pending = await db.outbox
      .orderBy('createdAt')
      .filter((entry) => entry.status === 'pending')
      .toArray()

    for (const entry of pending) {
      let error: unknown
      try {
        error = await performOutboxOp(entry)
      } catch {
        return // network gone mid-flush — retry the whole pass later
      }
      if (!error) {
        await db.outbox.delete(entry.id!)
      } else {
        const retryCount = entry.retryCount + 1
        await db.outbox.update(entry.id!, {
          retryCount,
          status: retryCount >= MAX_RETRIES ? 'failed' : 'pending',
        })
      }
    }
  } finally {
    flushInFlight = false
  }
}

/** Requeues failed entries (fresh retry budget) and flushes immediately. */
export async function retryFailedWrites(): Promise<void> {
  await db.outbox
    .where('status')
    .equals('failed')
    .modify({ status: 'pending', retryCount: 0 })
  await flushOutbox()
}

/**
 * Flush on mount, whenever the browser reports connectivity returning, and
 * on a periodic fallback timer (the online event is not reliable across
 * every browser/network transition). Returns a stop function.
 */
export function startSyncManager(): () => void {
  const onOnline = () => void flushOutbox()
  window.addEventListener('online', onOnline)
  const timer = window.setInterval(() => void flushOutbox(), FLUSH_INTERVAL_MS)
  void flushOutbox()

  return () => {
    window.removeEventListener('online', onOnline)
    window.clearInterval(timer)
  }
}

export interface OutboxStatus {
  pending: number
  failed: number
}

/** Live pending/failed outbox counts for the AppShell sync banner. */
export function useOutboxStatus(): OutboxStatus {
  const [status, setStatus] = useState<OutboxStatus>({ pending: 0, failed: 0 })

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const entries = await db.outbox.toArray()
      let pending = 0
      let failed = 0
      for (const entry of entries) {
        if (entry.status === 'failed') failed++
        else pending++
      }
      return { pending, failed }
    }).subscribe({
      next: setStatus,
      error: (error) => console.error('Outbox status query failed', error),
    })
    return () => subscription.unsubscribe()
  }, [])

  return status
}
