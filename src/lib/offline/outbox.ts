import { supabase } from '@/lib/supabase'
import { db, type OutboxEntry } from '@/lib/db'

export type QueueWriteInput = Pick<
  OutboxEntry,
  'clientId' | 'table' | 'op' | 'payload' | 'match'
>

/** Runs one queued op against the server; returns the Supabase error, if any. */
export async function performOutboxOp(
  entry: QueueWriteInput,
): Promise<unknown> {
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

/**
 * Durable-first write (offline-mutation-outbox pattern): the entry is added
 * to the IndexedDB outbox BEFORE any network attempt, so a reload mid-request
 * can never lose it. When online, the op is then attempted immediately and
 * dequeued on success. Resolves 'synced' or 'queued'; only throws if even
 * queueing fails (e.g. IndexedDB unavailable).
 */
export async function queueWrite(
  input: QueueWriteInput,
): Promise<'synced' | 'queued'> {
  const outboxId = await db.outbox.add({
    ...input,
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  })

  if (navigator.onLine) {
    try {
      const error = await performOutboxOp(input)
      if (!error) {
        await db.outbox.delete(outboxId)
        return 'synced'
      }
    } catch {
      // Network-level failure — leave the entry queued for the next flush.
    }
  }
  return 'queued'
}
