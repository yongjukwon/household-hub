import type { ReactNode } from 'react'

interface ScreenProps {
  title: string
  /** Optional action rendered on the title row (e.g. an add button). */
  action?: ReactNode
  children?: ReactNode
}

/**
 * Shared screen layout: a consistent 22px/800 page title (per the design
 * reference) and a centered, width-capped content column.
 */
export function Screen({ title, action, children }: ScreenProps) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5 md:px-8 md:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1
          className="text-[length:var(--hh-title-size)] font-[number:var(--hh-title-weight)] tracking-[var(--hh-title-tracking)] text-[var(--hh-ink)]"
        >
          {title}
        </h1>
        {action}
      </div>
      {children}
    </div>
  )
}
