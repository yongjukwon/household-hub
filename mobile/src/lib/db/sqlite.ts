import * as SQLite from 'expo-sqlite'

import type { OperationStore } from '../operations/store'
import type { DiscardedOperation, QueuedOperation } from '../operations/types'

const DATABASE_NAME = 'household-hub.db'
const SCHEMA_VERSION = 2
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null

/**
 * Creates the durable query-cache / operation-queue database. Mirrors the web
 * client's IndexedDB stores (queue + discards + a kv counter) on SQLite so both
 * platforms share one offline contract. JSON columns hold the command and the
 * optimistic/winner/warning blobs, keeping the row an exact copy of the command
 * that a cold start can replay.
 */
export function createSqliteOperationStore(): OperationStore {
  return {
    async addOperation(op) {
      const database = await openHouseholdDatabase()
      await database.runAsync(
        `INSERT INTO operations
           (operation_id, local_sequence, household_id, entity_type, entity_id,
            command, optimistic, enqueued_at, attempts, last_error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        op.operationId,
        op.localSequence,
        op.householdId,
        op.entityType,
        op.entityId,
        JSON.stringify(op.command),
        op.optimistic === null ? null : JSON.stringify(op.optimistic),
        op.enqueuedAt,
        op.attempts,
        op.lastError,
      )
    },

    async listOperations() {
      const database = await openHouseholdDatabase()
      const rows = await database.getAllAsync<OperationRow>(
        'SELECT * FROM operations ORDER BY local_sequence ASC',
      )
      return rows.map(rowToOperation)
    },

    async countOperations() {
      const database = await openHouseholdDatabase()
      const row = await database.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM operations',
      )
      return row?.n ?? 0
    },

    async countOperationsForEntity(entityType, entityId) {
      const database = await openHouseholdDatabase()
      const row = await database.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM operations WHERE entity_type = ? AND entity_id = ?',
        entityType,
        entityId,
      )
      return row?.n ?? 0
    },

    async updateOperationAttempt(operationId, attempts, lastError) {
      const database = await openHouseholdDatabase()
      await database.runAsync(
        'UPDATE operations SET attempts = ?, last_error = ? WHERE operation_id = ?',
        attempts,
        lastError,
        operationId,
      )
    },

    async deleteOperation(operationId) {
      const database = await openHouseholdDatabase()
      await database.runAsync(
        'DELETE FROM operations WHERE operation_id = ?',
        operationId,
      )
    },

    async discardOperation(record, operationId) {
      const database = await openHouseholdDatabase()
      await database.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `INSERT OR REPLACE INTO discarded_operations
             (operation_id, reason, command, discarded_at, winner, code,
              explanation, details, warnings, acknowledged_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          record.operationId,
          record.reason,
          JSON.stringify(record.command),
          record.discardedAt,
          record.winner === null ? null : JSON.stringify(record.winner),
          record.code,
          record.explanation,
          JSON.stringify(record.details),
          JSON.stringify(record.warnings),
          record.acknowledgedAt,
        )
        await txn.runAsync(
          'DELETE FROM operations WHERE operation_id = ?',
          operationId,
        )
      })
    },

    async getDiscarded(operationId) {
      const database = await openHouseholdDatabase()
      const row = await database.getFirstAsync<DiscardRow>(
        'SELECT * FROM discarded_operations WHERE operation_id = ?',
        operationId,
      )
      return row ? rowToDiscard(row) : null
    },

    async listDiscarded() {
      const database = await openHouseholdDatabase()
      const rows = await database.getAllAsync<DiscardRow>(
        'SELECT * FROM discarded_operations',
      )
      return rows.map(rowToDiscard)
    },

    async acknowledgeDiscarded(operationId, acknowledgedAt) {
      const database = await openHouseholdDatabase()
      await database.runAsync(
        'UPDATE discarded_operations SET acknowledged_at = ? WHERE operation_id = ?',
        acknowledgedAt,
        operationId,
      )
    },

    async nextSequence(key) {
      const database = await openHouseholdDatabase()
      let next = 1
      await database.withExclusiveTransactionAsync(async (txn) => {
        const row = await txn.getFirstAsync<{ value: number }>(
          'SELECT value FROM kv WHERE key = ?',
          key,
        )
        next = (row?.value ?? 0) + 1
        await txn.runAsync(
          `INSERT INTO kv (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          key,
          next,
        )
      })
      return next
    },

    async clear() {
      const database = await openHouseholdDatabase()
      await database.execAsync(
        'DELETE FROM operations; DELETE FROM discarded_operations; DELETE FROM kv; DELETE FROM query_cache;',
      )
    },
  }
}

export async function openHouseholdDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (databasePromise) return databasePromise
  databasePromise = open()
  return databasePromise
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME)
  await database.execAsync(`
    PRAGMA journal_mode = 'wal';
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY NOT NULL,
      value INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS operations (
      operation_id TEXT PRIMARY KEY NOT NULL,
      local_sequence INTEGER NOT NULL,
      household_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      command TEXT NOT NULL,
      optimistic TEXT,
      enqueued_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS operations_local_sequence
      ON operations (local_sequence);
    CREATE INDEX IF NOT EXISTS operations_entity
      ON operations (entity_type, entity_id);
    CREATE TABLE IF NOT EXISTS discarded_operations (
      operation_id TEXT PRIMARY KEY NOT NULL,
      reason TEXT NOT NULL,
      command TEXT NOT NULL,
      discarded_at TEXT NOT NULL,
      winner TEXT,
      code TEXT,
      explanation TEXT NOT NULL,
      details TEXT NOT NULL,
      warnings TEXT NOT NULL,
      acknowledged_at TEXT
    );
    CREATE TABLE IF NOT EXISTS query_cache (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    PRAGMA user_version = ${SCHEMA_VERSION};
  `)
  return database
}

export interface QueryCacheStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** Durable JSON storage used by React Query's persisted-client adapter. */
export function createSqliteQueryCacheStore(): QueryCacheStore {
  return {
    async get(key) {
      const database = await openHouseholdDatabase()
      const row = await database.getFirstAsync<{ value: string }>(
        'SELECT value FROM query_cache WHERE key = ?',
        key,
      )
      return row?.value ?? null
    },
    async set(key, value) {
      const database = await openHouseholdDatabase()
      await database.runAsync(
        `INSERT INTO query_cache (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`,
        key,
        value,
        new Date().toISOString(),
      )
    },
    async remove(key) {
      const database = await openHouseholdDatabase()
      await database.runAsync('DELETE FROM query_cache WHERE key = ?', key)
    },
  }
}

interface OperationRow {
  operation_id: string
  local_sequence: number
  household_id: string
  entity_type: string
  entity_id: string
  command: string
  optimistic: string | null
  enqueued_at: string
  attempts: number
  last_error: string | null
}

interface DiscardRow {
  operation_id: string
  reason: string
  command: string
  discarded_at: string
  winner: string | null
  code: string | null
  explanation: string
  details: string
  warnings: string
  acknowledged_at: string | null
}

function rowToOperation(row: OperationRow): QueuedOperation {
  return {
    operationId: row.operation_id,
    localSequence: row.local_sequence,
    householdId: row.household_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    command: JSON.parse(row.command),
    optimistic: row.optimistic === null ? null : JSON.parse(row.optimistic),
    enqueuedAt: row.enqueued_at,
    attempts: row.attempts,
    lastError: row.last_error,
  }
}

function rowToDiscard(row: DiscardRow): DiscardedOperation {
  return {
    operationId: row.operation_id,
    reason: row.reason as DiscardedOperation['reason'],
    command: JSON.parse(row.command),
    discardedAt: row.discarded_at,
    winner: row.winner === null ? null : JSON.parse(row.winner),
    code: row.code,
    explanation: row.explanation,
    details: JSON.parse(row.details),
    warnings: JSON.parse(row.warnings),
    acknowledgedAt: row.acknowledged_at,
  }
}
