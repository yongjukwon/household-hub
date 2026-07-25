import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Accessible segmented control (radiogroup) styled with the --hh-* tokens. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex gap-1 rounded-[var(--hh-radius-control)] bg-[var(--hh-surface-2)] p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-[calc(var(--hh-radius-control)-4px)] px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[var(--hh-surface)] text-[var(--hh-ink)] shadow-[var(--hh-shadow-card)]'
                : 'text-[var(--hh-muted)]',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
