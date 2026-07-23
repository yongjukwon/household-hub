import { useRef, useState } from 'react'
import { useRenamePage, type PageRow } from '@/hooks/usePages'
import { cn } from '@/lib/utils'

interface EditableTitleProps {
  page: PageRow
  /** Extra classes so a view can tweak its header typography if needed. */
  className?: string
}

// The page title, click-to-edit in place. Kept inside an <h1> so it remains a
// heading (semantics + tests): display mode is a button that fills the
// heading; clicking swaps in an input with the same typography. Enter or blur
// saves via useRenamePage, Escape cancels, and a blank/unchanged/failed save
// reverts. Replaces the old "Rename" menu item — used in every page header.
const TITLE_CLASSES = 'text-[26px] font-bold tracking-tight text-[var(--text)]'

export function EditableTitle({ page, className }: EditableTitleProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(page.title)
  const renamePage = useRenamePage()
  // Guards blur from firing after Enter/Escape already resolved the edit.
  const resolvedRef = useRef(false)

  function startEditing() {
    setValue(page.title)
    resolvedRef.current = false
    setEditing(true)
  }

  async function commit() {
    if (resolvedRef.current) return
    resolvedRef.current = true
    const trimmed = value.trim()
    setEditing(false)
    if (!trimmed || trimmed === page.title) return
    try {
      await renamePage.mutateAsync({ pageId: page.id, title: trimmed })
    } catch (error) {
      console.error('Failed to rename page', error)
      // Header keeps showing the unchanged page.title on failure.
    }
  }

  function cancel() {
    resolvedRef.current = true
    setEditing(false)
    setValue(page.title)
  }

  return (
    <h1 className={cn(TITLE_CLASSES, 'min-w-0 flex-1', className)}>
      {editing ? (
        <input
          autoFocus
          aria-label="Page title"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void commit()
            } else if (event.key === 'Escape') {
              cancel()
            }
          }}
          className="w-full truncate bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          title="Click to rename"
          className="block w-full truncate text-left hover:opacity-80"
        >
          {page.title}
        </button>
      )}
    </h1>
  )
}
