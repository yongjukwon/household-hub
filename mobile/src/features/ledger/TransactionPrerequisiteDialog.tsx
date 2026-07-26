import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { CategoryKind } from './statements'

export type TransactionPrerequisite = 'asset' | 'category'

interface TransactionPrerequisiteDialogProps {
  open: boolean
  prerequisite: TransactionPrerequisite
  kind: CategoryKind
  onOpenChange: (open: boolean) => void
  onContinue: () => void
}

/** Explains and resolves the data required before a Ledger transaction can open. */
export function TransactionPrerequisiteDialog({
  open,
  prerequisite,
  kind,
  onOpenChange,
  onContinue,
}: TransactionPrerequisiteDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        prerequisite === 'asset'
          ? 'Add an Asset first'
          : `Add a ${kind} category first`
      }
      description={
        prerequisite === 'asset'
          ? `Every ${kind} entry must be linked to a CAD Asset so the balance updates automatically.`
          : `Create a ${kind} category before adding this entry.`
      }
      confirmLabel={
        prerequisite === 'asset' ? 'Create Asset' : 'Create Category'
      }
      destructive={false}
      onConfirm={onContinue}
    />
  )
}
