import type { RichNoteDocument } from '@household-hub/domain'

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

export interface NoteSummaryRow {
  id: string
  title: string
  revision: number
  updated_at: string
}

export interface NoteRow {
  id: string
  title: string
  document: unknown
  revision: number
}

export function emptyNoteDocument(): RichNoteDocument {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

export function mapNoteSummary(row: NoteSummaryRow): NoteSummary {
  return {
    id: row.id,
    title: row.title,
    revision: row.revision,
    updatedAt: row.updated_at,
  }
}

export function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    document: row.document as RichNoteDocument,
    revision: row.revision,
  }
}
