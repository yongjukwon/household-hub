import type { RichNoteDocument } from '@household-hub/domain'
import { enqueueOperation, type EnqueueOutcome } from '@/lib/operations'

/** Create/rename/edit a note's title and document. */
export function saveNote(
  householdId: string,
  note: { id: string; title: string; document: RichNoteDocument },
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = { title: note.title.trim(), document: note.document }
  return enqueueOperation({
    householdId,
    type: 'note.upsert',
    entityType: 'note',
    entityId: note.id,
    baseRevision,
    payload,
    optimistic: {
      ...payload,
      updatedAt: new Date().toISOString(),
      revision: baseRevision ?? 1,
    },
  })
}

/** Delete a note. */
export function deleteNote(
  householdId: string,
  noteId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'note.delete',
    entityType: 'note',
    entityId: noteId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}
