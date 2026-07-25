import {
  acknowledgeDiscard,
  explainDiscard,
  useDiscardedOperations,
  useOperationQueueStatus,
} from '@/lib/operations'

/**
 * Floating surface for the durable operation queue (Task 4): a quiet
 * "syncing…" pill while writes are pending, and a dismissible card per
 * discarded write explaining what failed and what won.
 */
export function SyncStatus() {
  const { pending } = useOperationQueueStatus()
  const discards = useDiscardedOperations()

  if (pending === 0 && discards.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 flex-col gap-2 md:bottom-4">
      {discards.map((record) => {
        const explanation = explainDiscard(record)
        return (
          <div
            key={record.operationId}
            role="alert"
            className="pointer-events-auto rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 text-sm shadow-[var(--hh-shadow-float)] ring-1 ring-[color-mix(in_oklch,var(--hh-danger),transparent_70%)]"
          >
            <p className="font-semibold text-[var(--hh-ink)]">
              {explanation.failedAction}
            </p>
            {explanation.winningAction && (
              <p className="mt-0.5 text-[var(--hh-muted)]">
                {explanation.winningAction}
              </p>
            )}
            <p className="mt-0.5 text-[var(--hh-muted)]">{explanation.reason}</p>
            <button
              type="button"
              onClick={() => void acknowledgeDiscard(record.operationId)}
              className="mt-2 text-xs font-semibold text-[var(--hh-accent)]"
            >
              Dismiss
            </button>
          </div>
        )
      })}

      {pending > 0 && (
        <div
          role="status"
          className="pointer-events-auto self-center rounded-full bg-[var(--hh-surface)] px-3 py-1 text-xs text-[var(--hh-muted)] shadow-[var(--hh-shadow-card)]"
        >
          {pending} {pending === 1 ? 'change' : 'changes'} syncing…
        </div>
      )}
    </div>
  )
}
