import type {
  ConflictWinner,
  OperationCommand,
  OperationResult,
  OperationWarning,
} from '@household-hub/domain'

export type { OperationCommand, OperationResult } from '@household-hub/domain'

export interface QueuedOperation {
  operationId: string
  localSequence: number
  householdId: string
  entityType: string
  entityId: string
  command: OperationCommand
  optimistic: Record<string, unknown> | null
  enqueuedAt: string
  attempts: number
  lastError: string | null
}

export interface DiscardedOperation {
  operationId: string
  reason: 'conflict' | 'rejected'
  command: OperationCommand
  discardedAt: string
  winner: ConflictWinner | null
  code: string | null
  explanation: string
  details: Record<string, unknown>
  warnings: OperationWarning[]
  acknowledgedAt: string | null
}

/** Durable storage seam used by the platform-specific operation adapters. */
export interface OperationStore {
  addOperation(operation: QueuedOperation): Promise<void>
  listOperations(): Promise<QueuedOperation[]>
  countOperations(): Promise<number>
  updateOperationAttempt(
    operationId: string,
    attempts: number,
    lastError: string,
  ): Promise<void>
  deleteOperation(operationId: string): Promise<void>
  discardOperation(
    record: DiscardedOperation,
    operationId: string,
  ): Promise<void>
}

export interface OperationTransport {
  apply(command: OperationCommand): Promise<OperationResult>
}

export interface OperationReplayerDependencies {
  store: OperationStore
  transport: OperationTransport
  isOnline: () => boolean | Promise<boolean>
  now: () => string
  invalidateHousehold?: (householdId: string) => void | Promise<void>
}

export interface FlushSummary {
  applied: number
  duplicate: number
  discarded: number
  remaining: number
  stoppedBy: string | null
  results: Record<string, OperationResult>
}

export interface OperationReplayer {
  flush(): Promise<FlushSummary>
}

/**
 * Shared FIFO replay implementation. Storage, transport, connectivity, and
 * cache invalidation stay outside this module so the same deep implementation
 * serves the web Dexie adapter and the native SQLite adapter.
 */
export function createOperationReplayer(
  dependencies: OperationReplayerDependencies,
): OperationReplayer {
  let flushInFlight: Promise<FlushSummary> | null = null

  return {
    flush() {
      if (flushInFlight) return flushInFlight
      flushInFlight = runFlush(dependencies).finally(() => {
        flushInFlight = null
      })
      return flushInFlight
    },
  }
}

async function runFlush(
  dependencies: OperationReplayerDependencies,
): Promise<FlushSummary> {
  const { store, transport, isOnline, now, invalidateHousehold } = dependencies
  const summary: FlushSummary = {
    applied: 0,
    duplicate: 0,
    discarded: 0,
    remaining: 0,
    stoppedBy: null,
    results: {},
  }

  if (!(await isOnline())) {
    summary.remaining = await store.countOperations()
    summary.stoppedBy = summary.remaining > 0 ? 'offline' : null
    return summary
  }

  const touchedHouseholds = new Set<string>()

  drain: while (true) {
    const pending = await store.listOperations()
    const unprocessed = pending.filter(
      (entry) => !(entry.operationId in summary.results),
    )
    if (unprocessed.length === 0) break

    for (const entry of unprocessed) {
      let result: OperationResult
      try {
        result = await transport.apply(entry.command)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await store.updateOperationAttempt(
          entry.operationId,
          entry.attempts + 1,
          message,
        )
        summary.stoppedBy = message
        break drain
      }

      touchedHouseholds.add(entry.householdId)
      summary.results[entry.operationId] = result

      switch (result.status) {
        case 'applied':
          summary.applied += 1
          await store.deleteOperation(entry.operationId)
          break
        case 'duplicate':
          summary.duplicate += 1
          await store.deleteOperation(entry.operationId)
          break
        case 'conflict':
        case 'rejected':
          summary.discarded += 1
          await store.discardOperation(
            makeDiscardedOperation(entry, result, now()),
            entry.operationId,
          )
          break
      }
    }
  }

  summary.remaining = await store.countOperations()
  for (const householdId of touchedHouseholds) {
    await invalidateHousehold?.(householdId)
  }
  return summary
}

function makeDiscardedOperation(
  entry: QueuedOperation,
  result: Extract<OperationResult, { status: 'conflict' | 'rejected' }>,
  discardedAt: string,
): DiscardedOperation {
  return result.status === 'conflict'
    ? {
        operationId: entry.operationId,
        reason: 'conflict',
        command: entry.command,
        discardedAt,
        winner: result.winner,
        code: null,
        explanation: result.reason,
        details: { currentRevision: result.currentRevision },
        warnings: [],
        acknowledgedAt: null,
      }
    : {
        operationId: entry.operationId,
        reason: 'rejected',
        command: entry.command,
        discardedAt,
        winner: null,
        code: result.code,
        explanation: result.reason,
        details: result.details,
        warnings: result.warnings,
        acknowledgedAt: null,
      }
}

/** In-memory adapter used by shared and platform contract tests. */
export class InMemoryOperationStore implements OperationStore {
  private operations = new Map<string, QueuedOperation>()
  private discarded = new Map<string, DiscardedOperation>()

  async addOperation(operation: QueuedOperation): Promise<void> {
    this.operations.set(operation.operationId, clone(operation))
  }

  async listOperations(): Promise<QueuedOperation[]> {
    return [...this.operations.values()]
      .sort((left, right) => left.localSequence - right.localSequence)
      .map(clone)
  }

  async countOperations(): Promise<number> {
    return this.operations.size
  }

  async updateOperationAttempt(
    operationId: string,
    attempts: number,
    lastError: string,
  ): Promise<void> {
    const operation = this.operations.get(operationId)
    if (operation) this.operations.set(operationId, { ...operation, attempts, lastError })
  }

  async deleteOperation(operationId: string): Promise<void> {
    this.operations.delete(operationId)
  }

  async discardOperation(
    record: DiscardedOperation,
    operationId: string,
  ): Promise<void> {
    this.discarded.set(record.operationId, clone(record))
    this.operations.delete(operationId)
  }

  async getDiscarded(operationId: string): Promise<DiscardedOperation | null> {
    const record = this.discarded.get(operationId)
    return record ? clone(record) : null
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
