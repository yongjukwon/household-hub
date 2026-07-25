import { db } from '@/lib/db'
import type { QueuedOperation } from './types'

/** Any server row the overlay can address. */
export interface EntityRow {
  id: string
  [key: string]: unknown
}

/**
 * Applies still-queued commands on top of rows just read from the server.
 *
 * Realtime invalidation refetches authoritative data that, by definition, does
 * not yet include commands sitting in the queue. Replaying the queue's
 * optimistic state over the fresh rows is what keeps a partner's incoming
 * change from making the user's own unsent edit disappear — and because the
 * overlay is derived from the durable queue rather than from React state, it
 * survives a reload just as the commands do.
 *
 * Queue order is authoritative: two queued commands for the same entity apply
 * in local sequence order, so the newest one wins.
 */
export function applyOptimisticOverlay<Row extends EntityRow>(
  rows: Row[],
  operations: QueuedOperation[],
  entityType: string,
): Row[] {
  const relevant = operations
    .filter((operation) => operation.entityType === entityType)
    .sort((a, b) => a.localSequence - b.localSequence)

  if (relevant.length === 0) return rows

  const merged = new Map<string, Row>()
  for (const row of rows) merged.set(row.id, row)

  for (const operation of relevant) {
    if (operation.optimistic === null) {
      merged.delete(operation.entityId)
      continue
    }

    const existing = merged.get(operation.entityId)
    merged.set(operation.entityId, {
      // A queued edit only carries the fields it changed, so it is layered on
      // the server row rather than replacing it.
      ...(existing ?? {}),
      ...operation.optimistic,
      id: operation.entityId,
    } as Row)
  }

  return [...merged.values()]
}

/** Reads the queue and overlays it in one step. */
export async function withOptimisticOverlay<Row extends EntityRow>(
  rows: Row[],
  entityType: string,
): Promise<Row[]> {
  const operations = await db.operations.orderBy('localSequence').toArray()
  return applyOptimisticOverlay(rows, operations, entityType)
}

/** True while any command for this entity is still unsent. */
export async function hasPendingOperations(
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const count = await db.operations
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .count()
  return count > 0
}
