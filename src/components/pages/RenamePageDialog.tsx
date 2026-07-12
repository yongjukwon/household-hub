import { useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRenamePage, type PageRow } from '@/hooks/usePages'

interface RenamePageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  page: PageRow
}

export function RenamePageDialog({
  open,
  onOpenChange,
  page,
}: RenamePageDialogProps) {
  const [title, setTitle] = useState(page.title)
  const [error, setError] = useState<string | null>(null)
  const renamePage = useRenamePage()

  function close() {
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Enter a page title.')
      return
    }
    if (trimmed === page.title) {
      close()
      return
    }

    setError(null)
    try {
      await renamePage.mutateAsync({ pageId: page.id, title: trimmed })
      close()
    } catch (mutationError) {
      console.error('Failed to rename page', mutationError)
      setError('Couldn’t rename the page — check your connection and try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename page</DialogTitle>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-page-title">Title</Label>
            <Input
              id="rename-page-title"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={!!error}
              required
            />
            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={renamePage.isPending}>
              {renamePage.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
