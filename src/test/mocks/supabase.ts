import { vi } from 'vitest'

export const mockGetSession = vi.fn()
export const mockOnAuthStateChange = vi.fn()
export const mockSignInWithPassword = vi.fn()
export const mockSignOut = vi.fn()
export const mockFrom = vi.fn()
export const mockChannel = vi.fn()
export const mockRpc = vi.fn()
export const mockRemoveChannel = vi.fn()

// One realtime channel mock per supabase.channel() call: chainable .on()
// records the postgres_changes handler so tests can fire fake events.
export interface ChannelMock {
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  handlers: Array<{ config: unknown; callback: (payload: unknown) => void }>
}

function makeChannelMock(): ChannelMock {
  const channel: ChannelMock = {
    handlers: [],
    on: vi.fn((_event: string, config: unknown, callback: never) => {
      channel.handlers.push({ config, callback })
      return channel
    }),
    subscribe: vi.fn(() => channel),
  }
  return channel
}

interface QueryResult {
  data: unknown
  error: unknown
}

// Mimics the shape of a supabase-js PostgrestFilterBuilder closely enough
// for hook tests: every method returns the same builder so calls chain
// arbitrarily (.select().eq().order() etc), and the builder itself is
// thenable so `await supabase.from(...).select(...)` resolves directly to
// { data, error } for list queries, while `.single()` resolves the same
// shape for single-row queries.
export interface QueryBuilderMock {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lt: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>
}

/**
 * Configures the next `supabase.from(...)` call to return a chainable
 * builder that resolves to `{ data, error }`, whether the code under test
 * awaits the builder directly (list queries) or calls `.single()`
 * (single-row queries). Returns the builder so tests can assert on which
 * chain methods were called with which arguments.
 */
export function mockFromResult(
  data: unknown,
  error: unknown = null,
): QueryBuilderMock {
  const result: QueryResult = { data, error }
  const builder: QueryBuilderMock = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  mockFrom.mockReturnValue(builder)
  return builder
}

export const supabase = {
  auth: {
    getSession: mockGetSession,
    onAuthStateChange: mockOnAuthStateChange,
    signInWithPassword: mockSignInWithPassword,
    signOut: mockSignOut,
  },
  from: mockFrom,
  rpc: mockRpc,
  channel: mockChannel,
  removeChannel: mockRemoveChannel,
}

export function resetSupabaseMocks() {
  mockGetSession.mockReset().mockResolvedValue({ data: { session: null } })
  mockOnAuthStateChange.mockReset().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  mockSignInWithPassword.mockReset()
  mockSignOut.mockReset().mockResolvedValue({ error: null })
  mockFrom.mockReset()
  mockRpc.mockReset().mockResolvedValue({ data: null, error: null })
  mockChannel.mockReset().mockImplementation(makeChannelMock)
  mockRemoveChannel.mockReset()
}

// Default behavior even before the first resetSupabaseMocks() call, since
// some suites render realtime-subscribing components without resetting.
mockChannel.mockImplementation(makeChannelMock)
