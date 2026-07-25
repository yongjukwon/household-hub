import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import type { RichNoteDocument } from '@household-hub/domain'
import { Screen } from '@/shell/Screen'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { ErrorState, LoadingState } from '@/shell/ui/states'
import { useActiveHousehold } from '@/features/household'
import { useNote } from './data'
import { deleteNote, saveNote } from './mutations'
import { RestrictedEditor } from './RestrictedEditor'

/** One note's editor: title and a restricted rich-text body. */
export function NoteScreen() {
  const { noteId } = useParams<{ noteId: string }>()
  const navigate = useNavigate()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const query = useNote(householdId, noteId)

  const [title, setTitle] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  // Tracks the revision our own edits are based on. The server increments by
  // exactly one per applied command, so we advance it locally after each
  // successful save rather than waiting on a refetch — letting a title edit
  // and a document edit made moments apart both use a fresh base revision.
  const revisionRef = useRef<number | null>(null)
  const loadedNoteId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!query.data || loadedNoteId.current === query.data.id) return
    loadedNoteId.current = query.data.id
    setTitle(query.data.title)
    revisionRef.current = query.data.revision
  }, [query.data])

  async function persist(next: { title: string; document: RichNoteDocument }) {
    if (!householdId || !noteId) return
    await saveNote(householdId, { id: noteId, ...next }, revisionRef.current)
    revisionRef.current = (revisionRef.current ?? 0) + 1
  }

  function handleTitleBlur() {
    if (!query.data || title.trim().length === 0 || title === query.data.title) return
    void persist({ title, document: query.data.document })
  }

  function handleDocumentChange(document: RichNoteDocument) {
    if (!query.data) return
    void persist({ title, document })
  }

  async function handleDelete() {
    if (!householdId || !noteId) return
    setBusy(true)
    try {
      await deleteNote(householdId, noteId, revisionRef.current)
      navigate('/notes')
    } finally {
      setBusy(false)
    }
  }

  if (query.isLoading) {
    return (
      <Screen title="Note">
        <LoadingState />
      </Screen>
    )
  }
  if (query.isError || !query.data) {
    return (
      <Screen title="Note">
        <ErrorState message="Could not load this note." onRetry={() => void query.refetch()} />
      </Screen>
    )
  }

  const deleteButton = (
    <button
      type="button"
      onClick={() => setConfirmDelete(true)}
      className="rounded-[var(--hh-radius-control)] px-3 py-1.5 text-sm font-medium text-[var(--hh-danger)]"
    >
      Delete
    </button>
  )

  return (
    <Screen title={query.data.title || 'Note'} action={deleteButton}>
      <Link
        to="/notes"
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--hh-muted)]"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        All notes
      </Link>

      <input
        aria-label="Note title"
        className="mb-3 w-full rounded-[var(--hh-radius-control)] border border-transparent bg-transparent px-1 py-1 text-lg font-semibold text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
      />

      <div className="min-h-[50vh] rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] shadow-[var(--hh-shadow-card)]">
        <RestrictedEditor content={query.data.document} onChange={handleDocumentChange} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this note?"
        description="This permanently removes the note. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
      {busy && <span className="sr-only" role="status">Working…</span>}
    </Screen>
  )
}
