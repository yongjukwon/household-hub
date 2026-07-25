import { useRef, useState } from 'react'
import { CheckIcon, PencilIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface EditableTitleProps {
  value: string
  ariaLabel: string
  onSave: (next: string) => Promise<string | null>
  level?: 1 | 2
}

/** Accessible inline heading editor shared by Grocery lists and Trips. */
export function EditableTitle({
  value,
  ariaLabel,
  onSave,
  level = 1,
}: EditableTitleProps) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const Heading = level === 1 ? 'h1' : 'h2'

  function beginEdit() {
    setDraft(value)
    setError(null)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function cancel() {
    setDraft(value)
    setError(null)
    setEditing(false)
  }

  async function submit() {
    if (saving) return
    const next = draft.trim()
    if (!next) {
      setError('Title cannot be blank')
      return
    }
    if (next === value) {
      setEditing(false)
      setError(null)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saveError = await onSave(next)
      if (saveError) {
        setError(saveError)
        return
      }
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <Heading className="text-2xl font-bold tracking-tight text-[var(--hh-ink)]">
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={beginEdit}
          className="group inline-flex items-center gap-2 text-left"
        >
          <span>{value}</span>
          <PencilIcon
            aria-hidden
            className="h-4 w-4 text-[var(--hh-muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </button>
      </Heading>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          aria-label={ariaLabel}
          value={draft}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void submit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void submit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              cancel()
            }
          }}
          className="min-w-0 flex-1 rounded-[var(--hh-radius-control)] border border-[var(--hh-accent)] bg-[var(--hh-surface)] px-2 py-1 text-2xl font-bold tracking-tight text-[var(--hh-ink)] outline-none"
        />
        <button
          type="button"
          aria-label="Save title"
          disabled={saving}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void submit()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--hh-accent)] disabled:opacity-50"
        >
          <CheckIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Cancel title edit"
          disabled={saving}
          onMouseDown={(event) => event.preventDefault()}
          onClick={cancel}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--hh-muted)] disabled:opacity-50"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-[var(--hh-danger)]">
          {error}
        </p>
      )}
    </div>
  )
}
