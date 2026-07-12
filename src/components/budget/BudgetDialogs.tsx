import { useRef, useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  currentMonthKey,
  monthBounds,
  useCreateBudgetCategory,
  useCreateBudgetEntry,
  useUpdateBudgetCategory,
  useUpdateBudgetEntry,
  type BudgetCategory,
  type BudgetEntry,
} from '@/hooks/useBudget'

const MAX_MONEY = 99_999_999.99
const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  category: BudgetCategory | null
  nextSortOrder: number
}

export function CategoryDialog({
  open,
  onOpenChange,
  pageId,
  category,
  nextSortOrder,
}: CategoryDialogProps) {
  const [name, setName] = useState(category?.name ?? '')
  const [limit, setLimit] = useState(
    category ? String(category.monthly_limit) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const createId = useRef<string | null>(null)
  const createCategory = useCreateBudgetCategory()
  const updateCategory = useUpdateBudgetCategory()
  const pending = createCategory.isPending || updateCategory.isPending

  function close() {
    createId.current = null
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Enter a category name.')
      return
    }
    const monthlyLimit = parseMoney(limit, true)
    if (monthlyLimit === null) {
      setError('Enter a monthly limit from $0 to $99,999,999.99.')
      return
    }

    setError(null)
    try {
      if (category) {
        await updateCategory.mutateAsync({
          id: category.id,
          pageId,
          name: trimmedName,
          monthlyLimit,
          sortOrder: category.sort_order,
        })
      } else {
        createId.current ??= crypto.randomUUID()
        await createCategory.mutateAsync({
          id: createId.current,
          pageId,
          name: trimmedName,
          monthlyLimit,
          sortOrder: nextSortOrder,
        })
      }
      close()
    } catch (mutationError) {
      console.error('Failed to save budget category', mutationError)
      setError(
        'Couldn’t save the category — check your connection and try again.',
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {category ? 'Edit category' : 'New category'}
          </DialogTitle>
          <DialogDescription>
            Set the spending limit used for every month.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="budget-category-name">Name</Label>
              <Input
                id="budget-category-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={!!error && !name.trim()}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-category-limit">Monthly limit</Label>
              <Input
                id="budget-category-limit"
                inputMode="decimal"
                placeholder="0.00"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                aria-describedby={error ? 'budget-category-error' : undefined}
                aria-invalid={!!error}
                required
              />
            </div>
            {error && (
              <p
                id="budget-category-error"
                role="alert"
                className="text-sm text-[var(--danger)]"
              >
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : category ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface EntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  month: string
  categories: BudgetCategory[]
  entry: BudgetEntry | null
  initialCategoryId: string | null
}

export function EntryDialog({
  open,
  onOpenChange,
  pageId,
  month,
  categories,
  entry,
  initialCategoryId,
}: EntryDialogProps) {
  const [categoryId, setCategoryId] = useState(
    entry?.category_id ?? initialCategoryId ?? categories[0]?.id ?? '',
  )
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [entryDate, setEntryDate] = useState(
    entry?.entry_date ?? defaultDateForMonth(month),
  )
  const [error, setError] = useState<string | null>(null)
  const createId = useRef<string | null>(null)
  const createEntry = useCreateBudgetEntry()
  const updateEntry = useUpdateBudgetEntry()
  const pending = createEntry.isPending || updateEntry.isPending

  function close() {
    createId.current = null
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = parseMoney(amount, false)
    const { start: monthStart, end: monthEnd } = monthBounds(month)
    if (!categoryId || parsedAmount === null || !entryDate) {
      setError('Choose a category, enter a positive amount, and select a date.')
      return
    }
    if (entryDate < monthStart || entryDate >= monthEnd) {
      setError('Choose a date within the month currently displayed.')
      return
    }

    const input = {
      id: entry?.id ?? (createId.current ??= crypto.randomUUID()),
      pageId,
      categoryId,
      amount: parsedAmount,
      description: description.trim() || null,
      entryDate,
    }

    setError(null)
    try {
      if (entry) await updateEntry.mutateAsync(input)
      else await createEntry.mutateAsync(input)
      close()
    } catch (mutationError) {
      console.error('Failed to save budget entry', mutationError)
      setError('Couldn’t save the entry — check your connection and try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit entry' : 'New entry'}</DialogTitle>
          <DialogDescription>
            Record spending against one budget category.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="budget-entry-category">Category</Label>
              <select
                id="budget-entry-category"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-entry-amount">Amount</Label>
              <Input
                id="budget-entry-amount"
                autoFocus
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-entry-description">Description</Label>
              <Input
                id="budget-entry-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-entry-date">Date</Label>
              <Input
                id="budget-entry-date"
                type="date"
                min={`${month}-01`}
                max={lastDateForMonth(month)}
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                aria-describedby={error ? 'budget-entry-error' : undefined}
                aria-invalid={!!error}
                required
              />
            </div>
            {error && (
              <p
                id="budget-entry-error"
                role="alert"
                className="text-sm text-[var(--danger)]"
              >
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : entry ? 'Save' : 'Add entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => Promise<void>
}

export function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: DeleteDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    if (pending) return
    setError(null)
    onOpenChange(false)
  }

  async function handleConfirm() {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      setPending(false)
      onOpenChange(false)
    } catch (mutationError) {
      console.error('Failed to delete budget item', mutationError)
      setPending(false)
      setError(
        'Couldn’t delete this item — check your connection and try again.',
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function parseMoney(value: string, allowZero: boolean): number | null {
  const trimmed = value.trim()
  if (!MONEY_PATTERN.test(trimmed)) return null
  const amount = Number(trimmed)
  if (!Number.isFinite(amount) || amount > MAX_MONEY) return null
  if (allowZero ? amount < 0 : amount <= 0) return null
  return amount
}

function defaultDateForMonth(month: string): string {
  const now = new Date()
  if (month === currentMonthKey(now)) {
    return `${month}-${String(now.getDate()).padStart(2, '0')}`
  }
  return `${month}-01`
}

function lastDateForMonth(month: string): string {
  const { end } = monthBounds(month)
  const [year, monthNumber] = end.split('-').map(Number)
  const lastDay = new Date(year, monthNumber - 1, 0).getDate()
  return `${month}-${String(lastDay).padStart(2, '0')}`
}
