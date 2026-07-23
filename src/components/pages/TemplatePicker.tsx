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
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const createPage = useCreatePage()

  function resetAndClose() {
    setTitle('')
    setTemplate(defaultTemplate)
    setStartDate('')
    setEndDate('')
    setError(null)
    onOpenChange(false)
  }

  async function handleCreate() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const withPeriod = template === 'trip'
    if (withPeriod && startDate && endDate && endDate < startDate) {
      setError('The end date can’t be before the start date.')
      return
    }

    setError(null)
    let page
    try {
      page = await createPage.mutateAsync({
        section: navItem.section,
        template,
        title: trimmedTitle,
        startDate: withPeriod ? startDate || null : null,
        endDate: withPeriod ? endDate || null : null,
      })
    } catch (err) {
      // Insert failed (network, RLS, or the household query not having
      // resolved yet): keep the dialog open with the typed title intact so
      // a retry is a single click.
      console.error('Failed to create page', err)
      setError(
        'Couldn’t create the page — check your connection and try again.',
      )
      return
    }
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
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            void handleCreate()
          }}
        >
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
            {template === 'trip' && (
              <div className="flex flex-col gap-1.5">
                <Label>Dates (optional)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    aria-label="Start date"
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                  <Input
                    aria-label="End date"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createPage.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </form>
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
          ? 'border-[var(--accent)] bg-[var(--accentSoft)] text-[var(--accent-ink)]'
          : 'border-[var(--line2)] text-[var(--text)]',
      )}
    >
      {label}
    </button>
  )
}
