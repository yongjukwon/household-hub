import Dexie, { type Table } from 'dexie'

import type {
  DiscardedOperation,
  QueuedOperation,
} from '@/lib/operations/types'

/**
 * One queued offline write. `clientId` is the target row's real primary key
 * (client-generated UUID), so retries are idempotent by construction: a
 * replayed upsert rewrites the identical row, never a duplicate.
 */
export interface OutboxEntry {
  id?: number
  clientId: string
  table: 'grocery_items' | 'trip_checklist_items' | 'calendar_events'
  op: 'upsert' | 'update' | 'delete'
  /** Row for upsert; changed columns for update; unused for delete. */
  payload: Record<string, unknown>
  /** Equality filters (e.g. { id, page_id }) for update/delete ops. */
  match: Record<string, unknown>
  createdAt: number
  retryCount: number
  status: 'pending' | 'failed'
}

interface KvEntry {
  key: string
  value: unknown
}

export class AppDB extends Dexie {
  outbox!: Table<OutboxEntry, number>
  kv!: Table<KvEntry, string>
  operations!: Table<QueuedOperation, string>
  discardedOperations!: Table<DiscardedOperation, string>

  constructor() {
    super('household-hub')
    this.version(1).stores({
      outbox: '++id, clientId, status, createdAt',
      kv: 'key',
    })
    // v2 adds the durable operation queue (Task 4). The legacy `outbox` stays
    // until the rebuilt feature screens replace the legacy ones in Task 6.
    this.version(2).stores({
      operations: 'operationId, localSequence, [entityType+entityId]',
      discardedOperations: 'operationId, discardedAt, acknowledgedAt',
    })
  }
}

export const db = new AppDB()
