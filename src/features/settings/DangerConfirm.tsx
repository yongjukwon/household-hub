import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'

/**
 * Destructive confirmation gated on typing an exact phrase (e.g. the household
 * name or the word DELETE). Used for account/household deletion, where a single
 * tap is too easy to trigger by accident.
 */
export function DangerConfirm({
  open,
  onOpenChange,
  title,
  description,
  confirmPhrase,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmPhrase: string
  confirmLabel: string
  onConfirm: () => Promise<void> | void
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const matches = typed.trim() === confirmPhrase

  async function handleConfirm() {
    if (!matches) return
    setBusy(true)
    try {
      await onConfirm()
      setTyped('')
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="space-y-3">
        <p className="text-sm text-[var(--hh-muted)]">{description}</p>
        <p className="text-sm text-[var(--hh-muted)]">
          Type <strong className="text-[var(--hh-ink)]">{confirmPhrase}</strong> to confirm.
        </p>
        <input
          className="w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-danger)]"
          value={typed}
          aria-label="Confirmation phrase"
          onChange={(e) => setTyped(e.target.value)}
        />
        <button
          type="button"
          disabled={!matches || busy}
          onClick={() => void handleConfirm()}
          className="w-full rounded-[var(--hh-radius-control)] bg-[var(--hh-danger)] px-4 py-2.5 font-semibold text-white disabled:opacity-40"
        >
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  )
}
