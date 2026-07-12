import { useState, type FormEvent } from 'react'
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
import { useUpdateGroceryItem, type GroceryItem } from '@/hooks/useGroceries'

const MAX_MONEY = 99_999_999.99
const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/

interface GroceryItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  item: GroceryItem
}

export function GroceryItemDialog({
  open,
  onOpenChange,
  pageId,
  item,
}: GroceryItemDialogProps) {
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState(
    item.last_price === null ? '' : String(item.last_price),
  )
  const [error, setError] = useState<string | null>(null)
  const updateItem = useUpdateGroceryItem()

  function close() {
    setError(null)
    onOpenChange(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Enter an item name.')
      return
    }
    const parsedPrice = parsePrice(price)
    if (parsedPrice === undefined) {
      setError('Enter a price from $0.01 to $99,999,999.99, or leave it blank.')
      return
    }

    setError(null)
    try {
      await updateItem.mutateAsync({
        id: item.id,
        pageId,
        name: trimmedName,
        lastPrice: parsedPrice,
      })
      close()
    } catch (mutationError) {
      console.error('Failed to save grocery item', mutationError)
      setError('Couldn’t save this item — check your connection and try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
          <DialogDescription>
            Recording a price adds it to this item’s price history.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="grocery-item-name">Name</Label>
              <Input
                id="grocery-item-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={!!error && !name.trim()}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grocery-item-price">Price</Label>
              <Input
                id="grocery-item-price"
                inputMode="decimal"
                placeholder="Optional"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                aria-describedby={error ? 'grocery-item-error' : undefined}
                aria-invalid={!!error}
              />
            </div>
            {error && (
              <p
                id="grocery-item-error"
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
            <Button type="submit" disabled={updateItem.isPending}>
              {updateItem.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Blank clears the price (null); invalid input is undefined. */
function parsePrice(value: string): number | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!MONEY_PATTERN.test(trimmed)) return undefined
  const amount = Number(trimmed)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_MONEY) {
    return undefined
  }
  return amount
}
