import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isRichNoteJson } from '@household-hub/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { enqueueOperation, resetDeviceIdentity } from '@/lib/operations'
import { emptyNoteDocument, useNote } from '@/features/notes/data'

// vi.mock below is hoisted above this file's imports, so the mock it
// references must be created through vi.hoisted rather than a plain const.
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

/**
 * Configures the next `supabase.from('household_notes')` call to resolve
 * `.maybeSingle()` with the given row (or `null` when there is no server row
 * yet), mirroring the chainable-builder shape of src/test/mocks/supabase.ts.
 */
function mockNoteRow(row: Record<string, unknown> | null) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: row, error: null })),
  }
  mockFrom.mockReturnValue(builder)
  return builder
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('emptyNoteDocument', () => {
  it('produces a document the shared restricted-note validator accepts', () => {
    expect(isRichNoteJson(emptyNoteDocument())).toBe(true)
  })
})

describe('useNote', () => {
  const HOUSEHOLD = '11111111-1111-4111-8111-111111111111'
  const NOTE_ID = '22222222-2222-4222-8222-222222222222'

  beforeEach(async () => {
    mockFrom.mockReset()
    await db.operations.clear()
    await resetDeviceIdentity()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  })

  it('reconstructs a note from the optimistic overlay when it has no server row yet', async () => {
    mockNoteRow(null)
    const document = emptyNoteDocument()
    await enqueueOperation({
      householdId: HOUSEHOLD,
      type: 'note.upsert',
      entityType: 'note',
      entityId: NOTE_ID,
      baseRevision: null,
      payload: { title: 'Grocery list', document },
      optimistic: { title: 'Grocery list', document, revision: 0 },
    })

    const { result } = renderHook(() => useNote(HOUSEHOLD, NOTE_ID), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      id: NOTE_ID,
      title: 'Grocery list',
      document,
      revision: 0,
    })
  })
})
