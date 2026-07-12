import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { monthLabel, shiftMonthKey } from '@/hooks/useBudget'

interface MonthPickerProps {
  month: string
  onChange: (month: string) => void
}

export function MonthPicker({ month, onChange }: MonthPickerProps) {
  return (
    <div
      className="flex items-center justify-between rounded-xl border border-[var(--line2)] bg-[var(--panel)] p-1"
      aria-label="Budget month"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonthKey(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <p
        className="text-sm font-semibold text-[var(--text)]"
        aria-live="polite"
      >
        {monthLabel(month)}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label="Next month"
        onClick={() => onChange(shiftMonthKey(month, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}
