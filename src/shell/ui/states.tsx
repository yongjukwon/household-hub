import type { ReactNode } from 'react'

/** Neutral loading placeholder (announced to assistive tech). */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="py-12 text-center text-sm text-[var(--hh-muted)]">
      {label}
    </p>
  )
}

/** Empty-list state with an optional call to action. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-8 text-center shadow-[var(--hh-shadow-card)]">
      <p className="font-semibold text-[var(--hh-ink)]">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--hh-muted)]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Error state with an optional retry. */
export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="py-12 text-center">
      <p className="text-sm text-[var(--hh-danger)]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-[var(--hh-radius-control)] bg-[var(--hh-surface)] px-4 py-2 text-sm font-medium text-[var(--hh-ink)] shadow-[var(--hh-shadow-card)]"
        >
          Try again
        </button>
      )}
    </div>
  )
}
