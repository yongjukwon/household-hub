import Dexie, { type Table } from 'dexie'

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

  constructor() {
    super('household-hub')
    this.version(1).stores({
      outbox: '++id, clientId, status, createdAt',
      kv: 'key',
    })
  }
}

export const db = new AppDB()
