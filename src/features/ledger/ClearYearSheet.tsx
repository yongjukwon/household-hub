import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { clearYear } from './statementMutations'
import type { LedgerYear } from './statements'

/**
 * Typed-year confirmation for clearing a Ledger year: the user must type the
 * year number exactly, matching the server's `confirmation` guard.
 */
export function ClearYearSheet({
  open,
  onOpenChange,
  householdId,
  year,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  year: LedgerYear
}) {
  const [typed, setTyped] = useState('')
  const [saving, setSaving] = useState(false)
  const matches = typed.trim() === String(year.year)

  async function handleClear() {
    if (!matches) return
    setSaving(true)
    try {
      await clearYear(householdId, year.id, year.year, year.revision)
      setTyped('')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={`Clear ${year.year}?`}>
      <div className="space-y-3">
        <p className="text-sm text-[var(--hh-muted)]">
          This permanently removes every category, limit, and transaction in{' '}
          {year.year}. Type <strong className="text-[var(--hh-ink)]">{year.year}</strong> to
          confirm.
        </p>
        <input
          className="w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]"
          value={typed}
          inputMode="numeric"
          aria-label="Confirm year"
          placeholder={String(year.year)}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button
          type="button"
          disabled={!matches || saving}
          onClick={() => void handleClear()}
          className="w-full rounded-[var(--hh-radius-control)] bg-[var(--hh-danger)] px-4 py-2.5 font-semibold text-white disabled:opacity-40"
        >
          Clear {year.year}
        </button>
      </div>
    </BottomSheet>
  )
}
