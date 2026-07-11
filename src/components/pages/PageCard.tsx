import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PageRow } from '@/hooks/usePages'

const LONG_PRESS_MS = 500

interface PageCardProps {
  page: PageRow
  /** Plural section route path, e.g. "/budget". */
  sectionPath: string
  onDelete: (id: string) => void
}

// Right-click (desktop) / long-press (mobile) opens a small "Delete page /
// Cancel" menu — the menu itself is the confirmation step, there's no
// second nested dialog.
export function PageCard({ page, sectionPath, onDelete }: PageCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const longPressTimer = useRef<number | undefined>(undefined)

  function handleContextMenu(event: React.MouseEvent) {
    event.preventDefault()
    setMenuOpen(true)
  }

  function startLongPress() {
    longPressTimer.current = window.setTimeout(() => {
      setMenuOpen(true)
    }, LONG_PRESS_MS)
  }

  function cancelLongPress() {
    window.clearTimeout(longPressTimer.current)
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <Link
        to={`${sectionPath}/${page.id}`}
        onContextMenu={handleContextMenu}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        onTouchMove={cancelLongPress}
        className="relative flex items-center justify-between border-b border-[var(--line2)] py-4 first:pt-0 last:border-b-0"
      >
        {/* Invisible full-row anchor so the menu opens positioned at this
            row (not the page origin) — opening itself is driven entirely
            by the context-menu/long-press handlers above, not by clicking
            this element, hence pointer-events-none. */}
        <DropdownMenuTrigger asChild>
          <span
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>
        <span className="text-[15px] text-[var(--text)]">{page.title}</span>
        <span className="text-sm text-[var(--meta)]">
          Edited{' '}
          {formatDistanceToNow(new Date(page.updated_at), {
            addSuffix: true,
          })}
        </span>
      </Link>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          className="text-[var(--danger)] focus:text-[var(--danger)]"
          onSelect={() => onDelete(page.id)}
        >
          Delete page
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setMenuOpen(false)}>
          Cancel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
