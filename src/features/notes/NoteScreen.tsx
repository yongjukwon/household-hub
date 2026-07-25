import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import type { RichNoteDocument } from '@household-hub/domain'
import { Screen } from '@/shell/Screen'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { ErrorState, LoadingState } from '@/shell/ui/states'
import { useActiveHousehold } from '@/features/household'
import { operationOutcomeError } from '@/lib/operations/outcome'
import { useNote, type Note } from './data'
import { deleteNote, saveNote } from './mutations'
import { RestrictedEditor } from './RestrictedEditor'
import { RestrictedNoteView } from './RestrictedNoteView'

interface NoteDraft {
  title: string
  document: RichNoteDocument
}

/** One note in plain read mode, with explicit Edit/Save/Cancel drafting. */
export function NoteScreen() {
  const { noteId } = useParams<{ noteId: string }>()
  const navigate = useNavigate()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const query = useNote(householdId, noteId)
  const [draft, setDraft] = useState<NoteDraft | null>(null)
  const [localSaved, setLocalSaved] = useState<Note | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (query.isLoading) {
    return <Screen title="Note"><LoadingState /></Screen>
  }
  if (query.isError || !query.data) {
    return (
      <Screen title="Note">
        <ErrorState
          message="Could not load this note."
          onRetry={() => void query.refetch()}
        />
      </Screen>
    )
  }

  const saved =
    localSaved &&
    localSaved.id === query.data.id &&
    localSaved.revision > query.data.revision
      ? localSaved
      : query.data
  const editing = draft !== null

  function beginEditing() {
    setError(null)
    setDraft({ title: saved.title, document: saved.document })
  }

  async function handleSave() {
    if (!draft || !householdId || !noteId) return
    if (!draft.title.trim()) {
      setError('Enter a note title.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const outcome = await saveNote(
        householdId,
        { id: noteId, title: draft.title, document: draft.document },
        saved.revision,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      setLocalSaved({
        id: noteId,
        title: draft.title.trim(),
        document: draft.document,
        revision: saved.revision + 1,
      })
      setDraft(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!householdId || !noteId) return
    setBusy(true)
    setError(null)
    try {
      const outcome = await deleteNote(householdId, noteId, saved.revision)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        setConfirmDelete(false)
        return
      }
      navigate('/notes')
    } finally {
      setBusy(false)
    }
  }

  const title = editing ? (
    <h1 className="text-[length:var(--hh-title-size)] font-[number:var(--hh-title-weight)] tracking-[var(--hh-title-tracking)] text-[var(--hh-ink)]">
      Edit note
    </h1>
  ) : (
    <button
      type="button"
      aria-label="Edit note title"
      onClick={beginEditing}
      className="text-left text-[length:var(--hh-title-size)] font-[number:var(--hh-title-weight)] tracking-[var(--hh-title-tracking)] text-[var(--hh-ink)]"
    >
      {saved.title || 'Note'}
    </button>
  )

  const action = editing ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setDraft(null)
          setError(null)
        }}
        className="rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-medium text-[var(--hh-muted)]"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleSave()}
        className="rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        Save
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={beginEditing}
        className="rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-semibold text-[var(--hh-accent)]"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-medium text-[var(--hh-danger)]"
      >
        Delete
      </button>
    </div>
  )

  return (
    <Screen title={title} action={action}>
      <Link
        to="/notes"
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--hh-muted)]"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        All notes
      </Link>

      {editing && draft ? (
        <>
          <input
            aria-label="Note title"
            className="mb-3 w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-lg font-semibold text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]"
            value={draft.title}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, title: event.target.value } : current,
              )
            }
            autoFocus
          />
          <div className="min-h-[50vh] rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] shadow-[var(--hh-shadow-card)]">
            <RestrictedEditor
              content={draft.document}
              onChange={(document) =>
                setDraft((current) =>
                  current ? { ...current, document } : current,
                )
              }
            />
          </div>
        </>
      ) : (
        <article className="min-h-[50vh] px-1 py-2">
          <RestrictedNoteView document={saved.document} />
        </article>
      )}

      {error && <p className="mt-3 text-sm text-[var(--hh-danger)]">{error}</p>}
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
