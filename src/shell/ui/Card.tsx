import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Surface card: white, rounded, soft-shadowed, per the design reference. */
export function Card({
  className,
  children,
  ...props
}: ComponentProps<'div'> & { children?: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
