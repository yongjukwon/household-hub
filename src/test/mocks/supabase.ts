import { vi } from 'vitest'

export const mockGetSession = vi.fn()
export const mockOnAuthStateChange = vi.fn()
export const mockSignInWithPassword = vi.fn()
export const mockSignOut = vi.fn()
export const mockFrom = vi.fn()

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
}

export function resetSupabaseMocks() {
  mockGetSession.mockReset().mockResolvedValue({ data: { session: null } })
  mockOnAuthStateChange.mockReset().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  mockSignInWithPassword.mockReset()
  mockSignOut.mockReset().mockResolvedValue({ error: null })
  mockFrom.mockReset()
}
