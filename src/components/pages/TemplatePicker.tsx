import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { cn } from '@/lib/utils'
import { useCreatePage } from '@/hooks/usePages'
import type { NavItem, PageTemplate } from '@/components/layout/nav-items'

interface TemplatePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navItem: NavItem
}

// Title input + template choice (design's "New page" sheet). Sections with
// a dedicated template (budget/trips/groceries) offer it alongside "Blank";
// notes has no template of its own, so only the title field is shown.
export function TemplatePicker({
  open,
  onOpenChange,
  navItem,
}: TemplatePickerProps) {
  const sectionTemplate = navItem.template
  const defaultTemplate: PageTemplate = sectionTemplate?.value ?? 'blank'
  const [title, setTitle] = useState('')
  const [template, setTemplate] = useState<PageTemplate>(defaultTemplate)
  const navigate = useNavigate()
  const createPage = useCreatePage()

  function resetAndClose() {
    setTitle('')
    setTemplate(defaultTemplate)
    onOpenChange(false)
  }

  async function handleCreate() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const page = await createPage.mutateAsync({
      section: navItem.section,
      template,
      title: trimmedTitle,
    })
    resetAndClose()
    navigate(`${navItem.path}/${page.id}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(next) : resetAndClose())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {navItem.label} page</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-title">Title</Label>
            <Input
              id="page-title"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled"
            />
          </div>
          {sectionTemplate && (
            <div className="flex flex-col gap-1.5">
              <Label>Template</Label>
              <div className="flex gap-2">
                <TemplateOption
                  label={sectionTemplate.label}
                  selected={template === sectionTemplate.value}
                  onClick={() => setTemplate(sectionTemplate.value)}
                />
                <TemplateOption
                  label="Blank"
                  selected={template === 'blank'}
                  onClick={() => setTemplate('blank')}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || createPage.isPending}
            onClick={handleCreate}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TemplateOption({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-sm',
        selected
          ? 'border-[var(--accent)] bg-[var(--accentSoft)] text-[var(--accent)]'
          : 'border-[var(--line2)] text-[var(--text)]',
      )}
    >
      {label}
    </button>
  )
}
