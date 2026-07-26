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
import type { QueryClient } from '@tanstack/react-query'
import { AppState, type AppStateStatus } from 'react-native'

import { isOnline, onReconnect } from '@/lib/net'
import { supabase } from '@/lib/supabase'
import { newUuid } from '@/lib/uuid'
import type { Json } from '@/types/database'
import { getDeviceId, nextLocalSequence } from './device'
import { getOperationStore } from './store'
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

export interface FlushSummary {
  applied: number
  duplicate: number
  discarded: number
  /** Commands still queued because the pass stopped early. */
  remaining: number
  stoppedBy: string | null
  /** Verdict per command the server ruled on during this pass. */
  results: Record<string, OperationResult>
}

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
 * Durable-first: the command is written to SQLite before any network attempt,
 * so a relaunch mid-request can never lose it. When online, it is then sent
 * immediately — but the queue, not the caller, owns the outcome.
 */
export async function enqueueOperation(
  input: EnqueueInput,
): Promise<EnqueueOutcome> {
  const householdId = asUuid(input.householdId, 'householdId')
  const entityId = asUuid(input.entityId, 'entityId')
  const baseRevision = asRevision(input.baseRevision, 'baseRevision')
  const operationId = asUuid(newUuid(), 'operationId')
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

  await getOperationStore().addOperation(queued)
  await invalidateHousehold(input.householdId)

  if (!(await isOnline())) return { status: 'queued', operationId }

  // Anything already queued must go first: the server serializes by the
  // device's local sequence, and an earlier command may be this one's parent.
  const summary = await flushOperations()
  const result = summary.results[operationId]
  if (!result) return { status: 'queued', operationId }

  if (result.status === 'conflict' || result.status === 'rejected') {
    const discarded = await getOperationStore().getDiscarded(operationId)
    if (discarded) return { status: 'discarded', operationId, discarded }
  }

  return { status: 'settled', operationId, result }
}

let flushInFlight: Promise<FlushSummary> | null = null

/**
 * Replays queued commands in local FIFO order.
 *
 * A transport failure stops the pass instead of skipping ahead: order is part
 * of the contract, and a later command may depend on an earlier one. Server
 * verdicts are final — applied and duplicate leave the queue, conflict and
 * rejection leave it as a discard record. Nothing is ever retried after the
 * server has ruled on it.
 */
export function flushOperations(): Promise<FlushSummary> {
  if (flushInFlight) return flushInFlight

  flushInFlight = runFlush().finally(() => {
    flushInFlight = null
  })
  return flushInFlight
}

async function runFlush(): Promise<FlushSummary> {
  const store = getOperationStore()
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

  const pending = await store.listOperations()
  const touchedHouseholds = new Set<string>()

  for (const entry of pending) {
    let result: OperationResult
    try {
      result = await applyCommand(entry.command)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await store.updateOperationAttempt(
        entry.operationId,
        entry.attempts + 1,
        message,
      )
      summary.stoppedBy = message
      break
    }

    touchedHouseholds.add(entry.householdId)
    summary.results[entry.operationId] = result

    switch (result.status) {
      case 'applied':
        summary.applied += 1
        await store.deleteOperation(entry.operationId)
        break
      case 'duplicate':
        // Already recorded by a previous attempt whose response was lost.
        summary.duplicate += 1
        await store.deleteOperation(entry.operationId)
        break
      case 'conflict':
      case 'rejected':
        summary.discarded += 1
        await discard(entry, result)
        break
    }
  }

  summary.remaining = await store.countOperations()
  for (const householdId of touchedHouseholds) {
    await invalidateHousehold(householdId)
  }
  return summary
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

async function discard(
  entry: QueuedOperation,
  result: Extract<OperationResult, { status: 'conflict' | 'rejected' }>,
): Promise<void> {
  const record: DiscardedOperation =
    result.status === 'conflict'
      ? {
          operationId: entry.operationId,
          reason: 'conflict',
          command: entry.command,
          discardedAt: new Date().toISOString(),
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
          discardedAt: new Date().toISOString(),
          winner: null,
          code: result.code,
          explanation: result.reason,
          details: result.details,
          warnings: result.warnings,
          acknowledgedAt: null,
        }

  await getOperationStore().discardOperation(record, entry.operationId)
}

async function invalidateHousehold(householdId: string): Promise<void> {
  await queryClient?.invalidateQueries({
    queryKey: queryKeys.household(householdId),
  })
}

/** Queued commands in replay order. */
export function pendingOperations(): Promise<QueuedOperation[]> {
  return getOperationStore().listOperations()
}

/** Discard records the user has not dismissed yet, newest first. */
export async function unacknowledgedDiscards(): Promise<DiscardedOperation[]> {
  const all = await getOperationStore().listDiscarded()
  return all
    .filter((record) => record.acknowledgedAt === null)
    .sort((a, b) => b.discardedAt.localeCompare(a.discardedAt))
}

export async function acknowledgeDiscard(operationId: string): Promise<void> {
  await getOperationStore().acknowledgeDiscarded(
    operationId,
    new Date().toISOString(),
  )
}

const FLUSH_INTERVAL_MS = 30_000

/**
 * Replays on start, when connectivity returns, when the app foregrounds, and on
 * a fallback timer — no single signal is reliable across every transition.
 * Returns a stop function.
 */
export function startOperationSync(): () => void {
  const flush = () => void flushOperations()

  const stopReconnect = onReconnect(flush)
  const appStateSub = AppState.addEventListener(
    'change',
    (state: AppStateStatus) => {
      if (state === 'active') flush()
    },
  )
  const timer = setInterval(flush, FLUSH_INTERVAL_MS)
  flush()

  return () => {
    stopReconnect()
    appStateSub.remove()
    clearInterval(timer)
  }
}
