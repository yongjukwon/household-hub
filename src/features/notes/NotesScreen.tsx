import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Screen } from '@/shell/Screen'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import { useActiveHousehold } from '@/features/household'
import { emptyNoteDocument, useNotes } from './data'
import { saveNote } from './mutations'

/** Notes destination: the index of named documents. */
export function NotesScreen() {
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const notes = useNotes(householdId)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  async function addNote() {
    if (!householdId || title.trim().length === 0) return
    setSaving(true)
    try {
      await saveNote(
        householdId,
        { id: crypto.randomUUID(), title, document: emptyNoteDocument() },
        null,
      )
      setTitle('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const addButton = (
    <button
      type="button"
      onClick={() => setAdding(true)}
      aria-label="New note"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hh-accent)] text-white"
    >
      <PlusIcon className="h-5 w-5" />
    </button>
  )

  return (
    <Screen title="Notes" action={addButton}>
      {notes.isLoading ? (
        <LoadingState />
      ) : notes.isError ? (
        <ErrorState message="Could not load your notes." onRetry={() => void notes.refetch()} />
      ) : (notes.data ?? []).length === 0 ? (
        <EmptyState
          title="No notes yet"
          hint="Create a note to start writing."
          action={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2 font-medium text-white"
            >
              New note
            </button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {(notes.data ?? []).map((note) => (
            <li key={note.id}>
              <Link
                to={`/notes/${note.id}`}
                className="flex items-center justify-between rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]"
              >
                <span className="font-medium text-[var(--hh-ink)]">{note.title}</span>
                <ChevronRightIcon className="h-5 w-5 text-[var(--hh-muted)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <BottomSheet open={adding} onOpenChange={setAdding} title="New note">
        <div className="space-y-3">
          <input
            className="w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]"
            placeholder="Note title"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addNote()
            }}
          />
          <button
            type="button"
            disabled={saving || title.trim().length === 0}
            onClick={() => void addNote()}
            className="w-full rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            Create
          </button>
        </div>
      </BottomSheet>
    </Screen>
  )
}
