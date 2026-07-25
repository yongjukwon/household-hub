import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children?: ReactNode
}

/** Short-form sheet that slides up from the bottom (the native mobile idiom). */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-[calc(var(--hh-radius-card)+4px)] bg-[var(--hh-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[var(--hh-ink)] shadow-[var(--hh-shadow-float)]">
          <div
            aria-hidden
            className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--hh-line)]"
          />
          <Dialog.Title className="text-base font-semibold text-[var(--hh-ink)]">
            {title}
          </Dialog.Title>
          <div className="mt-3">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
