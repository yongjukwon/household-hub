import { db, type OutboxEntry } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export interface LegacyOutboxMigrationResult {
  drained: number
  remaining: number
  stoppedBy: string | null
}

/**
 * Replays entries written by the retired page-era web client. This is a
 * compatibility drain only: new writes must use the durable operation queue.
 * Entries are deleted only after Supabase accepts them, so an offline launch
 * or a transport failure remains recoverable on the next launch.
 */
export async function drainLegacyOutbox(): Promise<LegacyOutboxMigrationResult> {
  if (!navigator.onLine) {
    return {
      drained: 0,
      remaining: await db.outbox.count(),
      stoppedBy: 'offline',
    }
  }

  let drained = 0
  let stoppedBy: string | null = null
  const pending = await db.outbox
    .orderBy('createdAt')
    .filter((entry) => entry.status === 'pending')
    .toArray()

  for (const entry of pending) {
    try {
      const error = await performLegacyOutboxOperation(entry)
      if (error) {
        stoppedBy = error.message ?? 'legacy outbox operation rejected'
        await db.outbox.update(entry.id!, {
          retryCount: entry.retryCount + 1,
          status: 'failed',
        })
        break
      }
      await db.outbox.delete(entry.id!)
      drained += 1
    } catch (error) {
      stoppedBy = error instanceof Error ? error.message : String(error)
      break
    }
  }

  return { drained, remaining: await db.outbox.count(), stoppedBy }
}

async function performLegacyOutboxOperation(
  entry: OutboxEntry,
): Promise<{ message?: string } | null> {
  if (entry.op === 'upsert') {
    const { error } = await supabase
      .from(entry.table)
      .upsert(entry.payload as never, { onConflict: 'id' })
    return error
  }

  let query =
    entry.op === 'update'
      ? supabase.from(entry.table).update(entry.payload as never)
      : supabase.from(entry.table).delete()
  for (const [column, value] of Object.entries(entry.match)) {
    query = query.eq(column, value as never)
  }
  const { error } = await query
  return error
}
