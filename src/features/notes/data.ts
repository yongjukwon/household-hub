import { useQuery } from '@tanstack/react-query'
import { queryKeys, type RichNoteDocument } from '@household-hub/domain'
import { supabase } from '@/lib/supabase'
import { withOptimisticOverlay } from '@/lib/operations'
import type { Tables } from '@/types/database'

export interface NoteSummary {
  id: string
  title: string
  revision: number
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  document: RichNoteDocument
  revision: number
}

/** The empty note body: a single empty paragraph. */
export function emptyNoteDocument(): RichNoteDocument {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

function toSummary(row: Pick<Tables<'household_notes'>, 'id' | 'title' | 'revision' | 'updated_at'>): NoteSummary {
  return { id: row.id, title: row.title, revision: row.revision, updatedAt: row.updated_at }
}

/** Named notes in the household, most recently updated first. */
export function useNotes(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId ? queryKeys.notes.list(householdId) : ['notes', 'off'],
    enabled: !!householdId,
    queryFn: async (): Promise<NoteSummary[]> => {
      const { data, error } = await supabase
        .from('household_notes')
        .select('id, title, revision, updated_at')
        .order('updated_at', { ascending: false })
        .returns<Pick<Tables<'household_notes'>, 'id' | 'title' | 'revision' | 'updated_at'>[]>()
      if (error) throw error
      return withOptimisticOverlay((data ?? []).map(toSummary), 'note')
    },
  })
}

/** One note's full document, for the editor screen. */
export function useNote(householdId: string | undefined, noteId: string | undefined) {
  return useQuery({
    queryKey:
      householdId && noteId ? queryKeys.notes.note(householdId, noteId) : ['notes', 'note', 'off'],
    enabled: !!householdId && !!noteId,
    queryFn: async (): Promise<Note | null> => {
      const { data, error } = await supabase
        .from('household_notes')
        .select('id, title, document, revision')
        .eq('id', noteId!)
        .maybeSingle<Pick<Tables<'household_notes'>, 'id' | 'title' | 'document' | 'revision'>>()
      if (error) throw error
      const rows = data
        ? [{
            id: data.id,
            title: data.title,
            document: data.document as unknown as RichNoteDocument,
            revision: data.revision,
          }]
        : []
      const [note] = await withOptimisticOverlay(rows, 'note')
      return note ?? null
    },
  })
}
