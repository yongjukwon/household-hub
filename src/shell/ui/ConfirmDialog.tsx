import { AlertDialog } from 'radix-ui'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

/** Destructive confirmation (native alert-dialog semantics). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-5 text-[var(--hh-ink)] shadow-[var(--hh-shadow-float)]">
          <AlertDialog.Title className="text-base font-semibold text-[var(--hh-ink)]">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-1 text-sm text-[var(--hh-muted)]">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel className="rounded-[var(--hh-radius-control)] px-4 py-2 text-sm font-medium text-[var(--hh-ink)]">
              {cancelLabel}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className={cn(
                'rounded-[var(--hh-radius-control)] px-4 py-2 text-sm font-semibold',
                destructive
                  ? 'bg-[var(--hh-danger)] text-white'
                  : 'bg-[var(--hh-accent)] text-[var(--hh-accent-contrast)]',
              )}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
