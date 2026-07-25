import { isRichNoteJson } from '@household-hub/domain'
import { describe, expect, it } from 'vitest'
import { emptyNoteDocument } from '@/features/notes/data'

describe('emptyNoteDocument', () => {
  it('produces a document the shared restricted-note validator accepts', () => {
    expect(isRichNoteJson(emptyNoteDocument())).toBe(true)
  })
})
