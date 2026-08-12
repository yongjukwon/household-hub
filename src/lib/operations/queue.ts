import {
  isOperationResult,
  isRevision,
  isUuid,
  queryKeys,
  type OperationCommand,
  type OperationResult,
  type OperationType,
  type Revision,
  type UUID,
} from '@household-hub/domain'
import {
  createOperationReplayer,
  type FlushSummary,
} from '@household-hub/application/operations'
import type { QueryClient } from '@tanstack/react-query'

import { db } from '@/lib/db'
import type { Json } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { getDeviceId, nextLocalSequence } from './device'
import { webOperationStore } from './store'
import type { DiscardedOperation, QueuedOperation } from './types'

export interface EnqueueInput {
  householdId: string
  type: OperationType
  entityType: string
  entityId: string
  /** The revision the edit was based on; null when creating the entity. */
  baseRevision: number | null
  payload: Record<string, unknown>
  /** Expected entity state after this command; null for a delete. */
  optimistic: Record<string, unknown> | null
}

export type EnqueueOutcome =
  /** Reached the server and applied (or was already applied). */
  | { status: 'settled'; operationId: string; result: OperationResult }
  /** Durably stored; the sync loop will replay it. */
  | { status: 'queued'; operationId: string }
  /** Reached the server and lost; see the discard record. */
  | { status: 'discarded'; operationId: string; discarded: DiscardedOperation }

export type { FlushSummary }

/**
 * Identifiers are validated at the boundary rather than cast: a malformed id
 * would otherwise reach the server inside an otherwise well-formed command and
 * come back as an opaque rejection.
 */
function asUuid(value: string, label: string): UUID {
  if (!isUuid(value)) throw new Error(`${label} must be a UUID, got "${value}"`)
  return value
}

function asRevision(value: number | null, label: string): Revision | null {
  if (value === null) return null
  if (!isRevision(value)) {
    throw new Error(`${label} must be a revision of at least 1, got ${value}`)
  }
  return value
}

let queryClient: QueryClient | null = null

/**
 * The queue invalidates React Query itself after a command settles, so callers
 * do not have to thread a client through every mutation.
 */
export function setOperationQueryClient(client: QueryClient | null): void {
  queryClient = client
}

/**
 * Durable-first: the command is written to IndexedDB before any network
 * attempt, so a reload mid-request can never lose it. When online, it is then
 * sent immediately — but the queue, not the caller, owns the outcome.
 */
export async function enqueueOperation(
  input: EnqueueInput,
): Promise<EnqueueOutcome> {
  const householdId = asUuid(input.householdId, 'householdId')
  const entityId = asUuid(input.entityId, 'entityId')
  const baseRevision = asRevision(input.baseRevision, 'baseRevision')
  const operationId = asUuid(crypto.randomUUID(), 'operationId')
  const deviceId = asUuid(await getDeviceId(), 'deviceId')
  const localSequence = await nextLocalSequence()
  const enqueuedAt = new Date().toISOString()

  const command: OperationCommand = {
    schemaVersion: 1,
    operationId,
    deviceId,
    localSequence,
    householdId,
    type: input.type,
    entityType: input.entityType,
    entityId,
    baseRevision,
    enqueuedAt,
    payload: input.payload,
  }

  const queued: QueuedOperation = {
    operationId,
    localSequence,
    householdId: input.householdId,
    entityType: input.entityType,
    entityId: input.entityId,
    command,
    optimistic: input.optimistic,
    enqueuedAt,
    attempts: 0,
    lastError: null,
  }

  await webOperationStore.addOperation(queued)
  await invalidateHousehold(input.householdId)

  if (!navigator.onLine) return { status: 'queued', operationId }

  // Anything already queued must go first: the server serializes by the
  // device's local sequence, and an earlier command may be this one's parent.
  const summary = await flushOperations()
  const result = summary.results[operationId]
  if (!result) return { status: 'queued', operationId }

  if (result.status === 'conflict' || result.status === 'rejected') {
    const discarded = await db.discardedOperations.get(operationId)
    if (discarded) return { status: 'discarded', operationId, discarded }
  }

  return { status: 'settled', operationId, result }
}

const replayer = createOperationReplayer({
  store: webOperationStore,
  transport: { apply: applyCommand },
  isOnline: () => navigator.onLine,
  now: () => new Date().toISOString(),
  invalidateHousehold,
})

export function flushOperations(): Promise<FlushSummary> {
  return replayer.flush()
}

async function applyCommand(
  command: OperationCommand,
): Promise<OperationResult> {
  const { data, error } = await supabase.rpc('apply_household_operation', {
    // The command is JSON by construction; `payload` is only typed as an open
    // record, which the generated Json type cannot prove.
    command: command as unknown as Json,
  })

  if (error)
    throw new Error(error.message ?? 'apply_household_operation failed')
  if (!isOperationResult(data)) {
    // An unrecognized response is a transport-level problem, not a verdict —
    // dropping the command here would silently lose the user's write.
    throw new Error('apply_household_operation returned an unrecognized result')
  }
  return data
}

async function invalidateHousehold(householdId: string): Promise<void> {
  await queryClient?.invalidateQueries({
    queryKey: queryKeys.household(householdId),
  })
}

/** Queued commands in replay order. */
export function pendingOperations(): Promise<QueuedOperation[]> {
  return webOperationStore.listOperations()
}

/** Discard records the user has not dismissed yet, newest first. */
export async function unacknowledgedDiscards(): Promise<DiscardedOperation[]> {
  const all = await db.discardedOperations.toArray()
  return all
    .filter((record) => record.acknowledgedAt === null)
    .sort((a, b) => b.discardedAt.localeCompare(a.discardedAt))
}

export async function acknowledgeDiscard(operationId: string): Promise<void> {
  await db.discardedOperations.update(operationId, {
    acknowledgedAt: new Date().toISOString(),
  })
}

const FLUSH_INTERVAL_MS = 30_000

/**
 * Replays on mount, when connectivity returns, when the tab becomes visible,
 * and on a fallback timer — the `online` event alone is not reliable across
 * every browser and network transition. Returns a stop function.
 */
export function startOperationSync(): () => void {
  const flush = () => void flushOperations()
  const onVisible = () => {
    if (document.visibilityState === 'visible') flush()
  }

  window.addEventListener('online', flush)
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(flush, FLUSH_INTERVAL_MS)
  flush()

  return () => {
    window.removeEventListener('online', flush)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}
