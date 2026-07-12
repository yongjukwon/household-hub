import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RenamePageDialog } from './RenamePageDialog'
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
  const [renameOpen, setRenameOpen] = useState(false)
  const longPressTimer = useRef<number | undefined>(undefined)
  // Set when the long-press timer actually fires (menu opened by timer,
  // not by right-click/context-menu). iOS Safari synthesizes a click after
  // touchend even for a long press — this flag is how touchend/click tell
  // that synthetic click apart from a genuine short tap, so it can be
  // suppressed instead of navigating into the page out from under the
  // just-opened delete menu.
  const longPressTriggered = useRef(false)

  // Long-press timer is a real timer outliving the gesture that started
  // it — clear it on unmount so a press that's still pending when the row
  // is removed from the list (e.g. after a delete elsewhere re-renders
  // the list) can't fire setMenuOpen on an unmounted component.
  useEffect(() => {
    return () => {
      window.clearTimeout(longPressTimer.current)
    }
  }, [])

  function handleContextMenu(event: React.MouseEvent) {
    event.preventDefault()
    setMenuOpen(true)
  }

  function startLongPress() {
    longPressTriggered.current = false
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true
      setMenuOpen(true)
    }, LONG_PRESS_MS)
  }

  function cancelLongPress() {
    window.clearTimeout(longPressTimer.current)
  }

  function handleTouchEnd(event: React.TouchEvent) {
    cancelLongPress()
    if (longPressTriggered.current) {
      // The menu was just opened by the timer — prevent the synthetic
      // click iOS Safari fires after touchend from navigating into the
      // page (the click handler below guards this too, as a fallback for
      // browsers/tests where this preventDefault doesn't suppress it).
      event.preventDefault()
    }
  }

  function handleClick(event: React.MouseEvent) {
    if (longPressTriggered.current) {
      event.preventDefault()
      longPressTriggered.current = false
    }
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <Link
        to={`${sectionPath}/${page.id}`}
        onContextMenu={handleContextMenu}
        onTouchStart={startLongPress}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={cancelLongPress}
        onTouchMove={cancelLongPress}
        onClick={handleClick}
        className="relative flex items-center justify-between border-b border-[var(--line2)] py-4 first:pt-0 last:border-b-0 [-webkit-touch-callout:none] select-none"
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
        <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
          Rename
        </DropdownMenuItem>
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
      {renameOpen && (
        <RenamePageDialog
          key={page.title}
          open
          onOpenChange={setRenameOpen}
          page={page}
        />
      )}
    </DropdownMenu>
  )
}
