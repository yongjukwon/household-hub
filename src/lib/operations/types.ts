import type {
  ConflictWinner,
  OperationCommand,
  OperationWarning,
} from '@household-hub/domain'

/**
 * A command waiting to reach the server, plus everything needed to render it
 * optimistically and to replay it after a reload.
 *
 * The row IS the command — nothing about a queued write lives only in memory,
 * so a reload mid-flight resumes exactly where it left off.
 */
export interface QueuedOperation {
  operationId: string
  /** Device-local FIFO position; replay order, never the server's order. */
  localSequence: number
  householdId: string
  entityType: string
  entityId: string
  command: OperationCommand
  /**
   * What the client believes the entity looks like once this command applies:
   * the row for an upsert, `null` for a delete. Overlaid on server reads until
   * the command leaves the queue.
   */
  optimistic: Record<string, unknown> | null
  enqueuedAt: string
  attempts: number
  lastError: string | null
}

/**
 * A command that will never be retried, kept so the user can be told what
 * happened. The design is explicit that a losing mutation is discarded rather
 * than merged or re-edited.
 */
export interface DiscardedOperation {
  operationId: string
  reason: 'conflict' | 'rejected'
  command: OperationCommand
  discardedAt: string
  /** Present for a conflict: the operation that won the entity. */
  winner: ConflictWinner | null
  /** Present for a rejection: the server's stable code. */
  code: string | null
  explanation: string
  details: Record<string, unknown>
  warnings: OperationWarning[]
  /** Set once the user has seen it; unacknowledged records surface in the UI. */
  acknowledgedAt: string | null
}
