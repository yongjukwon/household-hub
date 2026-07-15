import { MoreHorizontal, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/currency'
import {
  useSavingsDepositRules,
  type SavingsSource,
} from '@/hooks/useSavings'

interface SourceCardProps {
  source: SavingsSource
  onDeposit: () => void
  onWithdraw: () => void
  onHistory: () => void
  onAutoDeposit: () => void
  onRename: () => void
  onDelete: () => void
}

export function SourceCard({
  source,
  onDeposit,
  onWithdraw,
  onHistory,
  onAutoDeposit,
  onRename,
  onDelete,
}: SourceCardProps) {
  const rulesQuery = useSavingsDepositRules(source.id)
  const activeRule = (rulesQuery.data ?? []).find((rule) => rule.active)

  return (
    <section
      className="rounded-xl border border-[var(--line2)] bg-[var(--panel)] p-4"
      aria-labelledby={`savings-source-${source.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            id={`savings-source-${source.id}`}
            className="truncate font-semibold text-[var(--text)]"
          >
            {source.name}
          </h3>
          <p className="mt-1 text-xl font-bold tracking-tight text-[var(--text)]">
            {formatCurrency(source.amount)}
          </p>
          {activeRule && (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--meta)]">
              <Repeat aria-hidden className="size-3" />
              {formatCurrency(activeRule.amount)} on the{' '}
              {ordinal(activeRule.day_of_month_1)} and{' '}
              {ordinal(activeRule.day_of_month_2)}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label={`Actions for ${source.name}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onDeposit}>Add deposit</DropdownMenuItem>
            <DropdownMenuItem onSelect={onWithdraw}>
              Add withdrawal
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onHistory}>
              View history
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAutoDeposit}>
              {activeRule || (rulesQuery.data ?? []).length > 0
                ? 'Edit auto-deposit'
                : 'Set up auto-deposit'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
            <DropdownMenuItem
              className="text-[var(--danger)] focus:text-[var(--danger)]"
              onSelect={onDelete}
            >
              Delete source
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
  )
}

function ordinal(day: number): string {
  const mod10 = day % 10
  const mod100 = day % 100
  if (mod10 === 1 && mod100 !== 11) return `${day}st`
  if (mod10 === 2 && mod100 !== 12) return `${day}nd`
  if (mod10 === 3 && mod100 !== 13) return `${day}rd`
  return `${day}th`
}
