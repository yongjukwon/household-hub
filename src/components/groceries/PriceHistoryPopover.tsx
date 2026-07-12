import { useState } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useGroceryPriceHistory } from '@/hooks/useGroceries'

interface PriceHistoryPopoverProps {
  pageId: string
  nameNormalized: string
  itemName: string
  formatCurrency: (amount: number) => string
}

export function PriceHistoryPopover({
  pageId,
  nameNormalized,
  itemName,
  formatCurrency,
}: PriceHistoryPopoverProps) {
  const [open, setOpen] = useState(false)
  // Only fetch once the popover is opened.
  const historyQuery = useGroceryPriceHistory(
    pageId,
    open ? nameNormalized : '',
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 text-[var(--meta)]"
          aria-label={`Price history for ${itemName}`}
        >
          <History />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <h4 className="text-xs font-semibold tracking-wide text-[var(--meta)]">
          PRICE HISTORY
        </h4>
        {historyQuery.isPending ? (
          <p role="status" className="mt-2 text-sm text-[var(--meta)]">
            Loading…
          </p>
        ) : historyQuery.isError ? (
          <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
            Couldn’t load price history.
          </p>
        ) : historyQuery.data.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--meta)]">
            No prices recorded yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {historyQuery.data.map((record) => (
              <li
                key={record.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="font-medium text-[var(--text)]">
                  {formatCurrency(record.price)}
                </span>
                <span className="text-xs text-[var(--meta)]">
                  {formatRecordedAt(record.recorded_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

const recordedAtFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatRecordedAt(value: string): string {
  return recordedAtFormatter.format(new Date(value))
}
