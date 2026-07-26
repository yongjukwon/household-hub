import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { operationOutcomeError } from '@/lib/operations/outcome'
import type { ChecklistEntry, Trip } from './data'
import { deleteChecklistEntry, saveChecklistEntry } from './mutations'

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const label = 'block text-sm font-medium text-[var(--hh-muted)]'

interface ChecklistSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  trip: Trip
  entry: ChecklistEntry
}

/** Edit (rename or delete) a checklist entry. Checked state toggles inline in the list. */
export function ChecklistSheet({
  open,
  onOpenChange,
  householdId,
  trip,
  entry,
}: ChecklistSheetProps) {
  const [labelValue, setLabelValue] = useState(entry.label)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (labelValue.trim().length === 0) {
      setError('Give this item a label.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await saveChecklistEntry(
        householdId,
        {
          id: entry.id,
          tripId: trip.id,
          label: labelValue,
          checked: entry.checked,
          sortOrder: entry.sortOrder,
        },
        entry.revision,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      const outcome = await deleteChecklistEntry(householdId, entry.id, entry.revision)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        setConfirmDelete(false)
        return
      }
      setConfirmDelete(false)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Edit checklist item">
      <div className="space-y-3">
        <div>
          <label className={label} htmlFor="checklist-label">
            Label
          </label>
          <input
            id="checklist-label"
            className={field}
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-[var(--hh-danger)]">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1 rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setConfirmDelete(true)}
            className="rounded-[var(--hh-radius-control)] px-4 py-2.5 font-medium text-[var(--hh-danger)]"
          >
            Delete
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this item?"
        description="This removes it from the checklist. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}
