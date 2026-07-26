import type { DiscardedOperation, QueuedOperation } from './types'

/**
 * Durable storage the operation queue sits on. The app backs this with
 * expo-sqlite (`../db/sqlite`); tests use `InMemoryOperationStore`. Keeping the
 * queue logic behind this interface is what lets the FIFO/replay/conflict rules
 * be tested without a native SQLite bridge, exactly as the web queue is tested
 * against fake-indexeddb.
 */
export interface OperationStore {
  addOperation(op: QueuedOperation): Promise<void>
  /** Queued commands in replay order (local sequence ascending). */
  listOperations(): Promise<QueuedOperation[]>
  countOperations(): Promise<number>
  countOperationsForEntity(entityType: string, entityId: string): Promise<number>
  updateOperationAttempt(
    operationId: string,
    attempts: number,
    lastError: string,
  ): Promise<void>
  deleteOperation(operationId: string): Promise<void>

  /** Records a discard and removes the queued command in one atomic step. */
  discardOperation(
    record: DiscardedOperation,
    operationId: string,
  ): Promise<void>
  getDiscarded(operationId: string): Promise<DiscardedOperation | null>
  listDiscarded(): Promise<DiscardedOperation[]>
  acknowledgeDiscarded(operationId: string, acknowledgedAt: string): Promise<void>

  /**
   * Atomically returns the next FIFO sequence for `key`, so two concurrent
   * enqueues can never share a number.
   */
  nextSequence(key: string): Promise<number>

  /** Test/reset helper: forget everything. */
  clear(): Promise<void>
}

/** In-memory store for tests. Deep-clones on the way in and out so callers
 * cannot mutate stored rows by reference, matching a real serializing store. */
export class InMemoryOperationStore implements OperationStore {
  private operations = new Map<string, QueuedOperation>()
  private discarded = new Map<string, DiscardedOperation>()
  private counters = new Map<string, number>()

  async addOperation(op: QueuedOperation): Promise<void> {
    this.operations.set(op.operationId, clone(op))
  }

  async listOperations(): Promise<QueuedOperation[]> {
    return [...this.operations.values()]
      .sort((a, b) => a.localSequence - b.localSequence)
      .map(clone)
  }

  async countOperations(): Promise<number> {
    return this.operations.size
  }

  async countOperationsForEntity(
    entityType: string,
    entityId: string,
  ): Promise<number> {
    let count = 0
    for (const op of this.operations.values()) {
      if (op.entityType === entityType && op.entityId === entityId) count += 1
    }
    return count
  }

  async updateOperationAttempt(
    operationId: string,
    attempts: number,
    lastError: string,
  ): Promise<void> {
    const existing = this.operations.get(operationId)
    if (existing) this.operations.set(operationId, { ...existing, attempts, lastError })
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

  async listDiscarded(): Promise<DiscardedOperation[]> {
    return [...this.discarded.values()].map(clone)
  }

  async acknowledgeDiscarded(
    operationId: string,
    acknowledgedAt: string,
  ): Promise<void> {
    const existing = this.discarded.get(operationId)
    if (existing) this.discarded.set(operationId, { ...existing, acknowledgedAt })
  }

  async nextSequence(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1
    this.counters.set(key, next)
    return next
  }

  async clear(): Promise<void> {
    this.operations.clear()
    this.discarded.clear()
    this.counters.clear()
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// Registry -----------------------------------------------------------------

let activeStore: OperationStore | null = null

/**
 * The store the queue uses. Lazily defaults to the SQLite-backed store; tests
 * call `setOperationStore(new InMemoryOperationStore())` before exercising the
 * queue. The dynamic import keeps expo-sqlite out of the module graph until the
 * app actually needs it, so importing the queue in a test never loads the
 * native module.
 */
export function getOperationStore(): OperationStore {
  if (!activeStore) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createSqliteOperationStore } = require('../db/sqlite') as typeof import('../db/sqlite')
    activeStore = createSqliteOperationStore()
  }
  return activeStore
}

export function setOperationStore(store: OperationStore | null): void {
  activeStore = store
}
