import {
  applyOptimisticOverlay,
  type EntityRow,
} from '@household-hub/application/operations'

import { db } from '@/lib/db'

export { applyOptimisticOverlay, type EntityRow }

/** Reads the queue and overlays it in one step. */
export async function withOptimisticOverlay<Row extends EntityRow>(
  rows: Row[],
  entityType: string,
  householdId?: string,
): Promise<Row[]> {
  const operations = await db.operations.orderBy('localSequence').toArray()
  // No revision repair: the Dexie queue never stored revision-less optimistic
  // payloads, and web rows own their revision semantics.
  return applyOptimisticOverlay(rows, operations, entityType, { householdId })
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
