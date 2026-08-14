import { isRevision } from '@household-hub/domain'

import type { QueuedOperation } from './index'

export interface EntityRow {
  id: string
}

export interface OptimisticOverlayOptions {
  /** Restrict the projection to one tenant's queued commands. */
  householdId?: string
  /**
   * Stamp a revision onto projected rows that do not already carry a valid
   * one. Off by default, and deliberately so: this is a storage-format repair,
   * not a projection rule.
   *
   * Native builds shipped before `b7e4958` persisted optimistic payloads with
   * no `revision`, and the native store can still hold them, so the native
   * adapter opts in. The web queue never had that shape, and web rows are
   * legitimately revision-free (a Calendar row projected for display) or carry
   * their own value with its own meaning (a Note uses revision 0 for "no
   * server row yet"). Stamping there would rewrite correct data.
   */
  repairLegacyRevisions?: boolean
}

/** Pure durable-queue projection shared by the web and native adapters. */
export function applyOptimisticOverlay<Row extends EntityRow>(
  rows: Row[],
  operations: QueuedOperation[],
  entityType: string,
  options: OptimisticOverlayOptions = {},
): Row[] {
  const { householdId, repairLegacyRevisions = false } = options
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
    if (repairLegacyRevisions && !isRevision(projected.revision)) {
      projected.revision = operation.command.baseRevision ?? 1
    }
    merged.set(operation.entityId, projected)
  }

  return [...merged.values()]
}
