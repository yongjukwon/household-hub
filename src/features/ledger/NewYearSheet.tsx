import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { operationOutcomeError } from '@/lib/operations/outcome'
import { createYear } from './statementMutations'
import type { LedgerYear } from './statements'

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'

export function NewYearSheet({
  open,
  onOpenChange,
  householdId,
  years,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  years: LedgerYear[]
}) {
  const [value, setValue] = useState(String(new Date().getFullYear()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const year = Number(value)
    if (!/^\d{4}$/.test(value.trim()) || year < 1900 || year > 9999) {
      setError('Enter a four-digit year.')
      return
    }
    if (years.some((entry) => entry.year === year)) {
      setError(`${year} already exists.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await createYear(householdId, crypto.randomUUID(), year)
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

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="New statement year">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-[var(--hh-muted)]" htmlFor="ledger-year">
          Year
        </label>
        <input
          id="ledger-year"
          className={field}
          inputMode="numeric"
          maxLength={4}
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/\D/g, '').slice(0, 4))}
          autoFocus
        />
        {error && <p className="text-sm text-[var(--hh-danger)]">{error}</p>}
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="w-full rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          Create year
        </button>
      </div>
    </BottomSheet>
  )
}
