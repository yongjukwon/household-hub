import { isRevision } from '@household-hub/domain'

import type { QueuedOperation } from './index'

export interface EntityRow {
  id: string
}

export interface OptimisticOverlayOptions {
  /** Restrict the projection to one tenant's queued commands. */
  householdId?: string
  /**
   * Compensate for operations persisted by older native builds whose payload
   * shape was wrong. Off by default, and deliberately so: these are
   * storage-format repairs, not projection rules. Only the native adapter opts
   * in, because only the native store can still hold those rows — and applying
   * them to web rewrites data the web client got right.
   *
   * Every repair this covers must be listed here:
   *
   * 1. **Missing revision.** Builds before `b7e4958` stored optimistic payloads
   *    with no `revision`. Web rows are legitimately revision-free (a Calendar
   *    row projected for display) or carry their own meaning (a Note uses
   *    revision 0 for "no server row yet"), so stamping there destroys data.
   * 2. **`ledger.year.clear` stored as an update.** Older builds persisted the
   *    clear with a non-null `optimistic`, so it projected as an edit instead
   *    of a removal. Native's current mutation sends `optimistic: null` and is
   *    already handled by the generic destructive rule below; web deliberately
   *    sends a real payload, because clearing a year empties it rather than
   *    deleting it — the year must stay in the list.
   */
  repairLegacyPayloads?: boolean
}

/** Pure durable-queue projection shared by the web and native adapters. */
export function applyOptimisticOverlay<Row extends EntityRow>(
  rows: Row[],
  operations: QueuedOperation[],
  entityType: string,
  options: OptimisticOverlayOptions = {},
): Row[] {
  const { householdId, repairLegacyPayloads = false } = options
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

    // A command that carries no optimistic state can only mean removal. Any
    // command that does carry one is an update, on every platform.
    const destructive = operation.optimistic === null
      || (repairLegacyPayloads
        && operation.command.type === 'ledger.year.clear')
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
    if (repairLegacyPayloads && !isRevision(projected.revision)) {
      projected.revision = operation.command.baseRevision ?? 1
    }
    merged.set(operation.entityId, projected)
  }

  return [...merged.values()]
}
