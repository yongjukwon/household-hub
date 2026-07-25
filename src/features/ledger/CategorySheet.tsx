import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import type { CategoryKind, CategoryProgress } from './statements'
import { deleteCategory, saveCategory, saveLimit } from './statementMutations'

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const label = 'block text-sm font-medium text-[var(--hh-muted)]'

interface CategorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  yearId: string
  month: number
  /** The existing category row for this month, or null to create. */
  existing: CategoryProgress | null
  /** Next sort order to use for a new category. */
  nextSortOrder: number
}

/**
 * Create or edit a category and its monthly limit, applied from the selected
 * month forward. Deleting is blocked server-side if this or a later month has
 * spending (surfaced as a discard warning).
 */
export function CategorySheet({
  open,
  onOpenChange,
  householdId,
  yearId,
  month,
  existing,
  nextSortOrder,
}: CategorySheetProps) {
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<CategoryKind>(existing?.kind ?? 'spending')
  const [limit, setLimit] = useState(centsToInputValue(existing?.limitCents ?? null))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    if (name.trim().length === 0) return
    setSaving(true)
    try {
      const categoryId = existing?.categoryId ?? crypto.randomUUID()
      await saveCategory(
        householdId,
        {
          id: categoryId,
          yearId,
          fromMonth: month,
          name,
          kind,
          sortOrder: existing?.sortOrder ?? nextSortOrder,
        },
        existing?.revision ?? null,
      )
      if (kind === 'spending') {
        const cents = parseDollarsToCents(limit)
        await saveLimit(
          householdId,
          categoryId, // limit entity id defaults to the category id
          categoryId,
          month,
          cents,
          null,
        )
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    setSaving(true)
    try {
      await deleteCategory(householdId, existing.categoryId, month, existing.revision)
      setConfirmDelete(false)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? 'Edit category' : 'New category'}
    >
      <div className="space-y-3">
        <div>
          <label className={label} htmlFor="cat-name">
            Name
          </label>
          <input
            id="cat-name"
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          {(['spending', 'income'] as CategoryKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              disabled={!!existing}
              onClick={() => setKind(k)}
              className={
                'flex-1 rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-medium capitalize disabled:opacity-60 ' +
                (kind === k
                  ? 'bg-[var(--hh-accent)] text-white'
                  : 'bg-[var(--hh-surface-2)] text-[var(--hh-muted)]')
              }
            >
              {k}
            </button>
          ))}
        </div>
        {kind === 'spending' && (
          <div>
            <label className={label} htmlFor="cat-limit">
              Monthly limit (optional)
            </label>
            <input
              id="cat-limit"
              className={field}
              inputMode="decimal"
              value={limit}
              placeholder="0.00"
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
        )}
        <p className="text-xs text-[var(--hh-muted)]">
          Applies from this month forward.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1 rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            Save
          </button>
          {existing && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmDelete(true)}
              className="rounded-[var(--hh-radius-control)] px-4 py-2.5 font-medium text-[var(--hh-danger)]"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete category?"
        description="Removes it from this month forward. Blocked if a later month already has spending."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}
