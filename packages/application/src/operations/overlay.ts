import { isRevision } from '@household-hub/domain'

import type { QueuedOperation } from './index'

export interface EntityRow {
  id: string
}

/** Pure durable-queue projection shared by the web and native adapters. */
export function applyOptimisticOverlay<Row extends EntityRow>(
  rows: Row[],
  operations: QueuedOperation[],
  entityType: string,
  householdId?: string,
): Row[] {
  const relevant = operations
    .filter(
      (operation) =>
        operation.entityType === entityType
        && (!householdId || operation.householdId === householdId),
    )
    .sort((left, right) => left.localSequence - right.localSequence)

  if (relevant.length === 0) return rows

  const merged = new Map<string, Row>()
  for (const row of rows) merged.set(row.id, row)

  for (const operation of relevant) {
    if (operation.command.type === 'notification.clear') {
      merged.clear()
      continue
    }

    const destructive = operation.optimistic === null
      || operation.command.type === 'ledger.year.clear'
    if (destructive) {
      merged.delete(operation.entityId)
      continue
    }

    const existing = merged.get(operation.entityId)
    const projected = {
      ...(existing ?? {}),
      ...operation.optimistic,
      id: operation.entityId,
    } as Row & { revision?: unknown }
    if (!isRevision(projected.revision)) {
      projected.revision = operation.command.baseRevision ?? 1
    }
    merged.set(operation.entityId, projected)
  }

  return [...merged.values()]
}
