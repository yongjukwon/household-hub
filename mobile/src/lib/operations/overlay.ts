import {
  applyOptimisticOverlay,
  type EntityRow,
} from '@household-hub/application/operations'

import { getOperationStore } from './store'

export { applyOptimisticOverlay, type EntityRow }

/** Reads the queue and overlays it in one step. */
export async function withOptimisticOverlay<Row extends EntityRow>(
  rows: Row[],
  entityType: string,
  householdId?: string,
): Promise<Row[]> {
  const operations = await getOperationStore().listOperations()
  // The native store can still hold operations enqueued by builds that shipped
  // before optimistic payloads carried a revision, so repair them on read.
  return applyOptimisticOverlay(rows, operations, entityType, {
    householdId,
    repairLegacyRevisions: true,
  })
}

/** True while any command for this entity is still unsent. */
export async function hasPendingOperations(
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const count = await getOperationStore().countOperationsForEntity(
    entityType,
    entityId,
  )
  return count > 0
}
