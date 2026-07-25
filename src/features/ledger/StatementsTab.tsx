import { EmptyState } from '@/shell/ui/states'

/**
 * Statements segment. Full implementation (years, months, categories, limits,
 * transactions, progress, deletion guards, clear-all) lands in checkpoint 6C-2;
 * this keeps the Ledger screen mountable in the meantime.
 */
export function StatementsTab({ householdId }: { householdId: string }) {
  void householdId
  return <EmptyState title="Statements" hint="Coming in the next update." />
}
