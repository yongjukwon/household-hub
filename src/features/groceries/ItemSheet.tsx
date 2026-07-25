import { useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import type { GroceryItem } from './data'
import { deleteGroceryItem, saveGroceryItem } from './mutations'

const fieldClass =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'
const labelClass = 'block text-sm font-medium text-[var(--hh-muted)]'

interface ItemSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  listId: string
  item: GroceryItem
  /** Position to keep when saving. */
  sortOrder: number
}

/** Edit an existing grocery item's name, quantity, and price (CAD). */
export function ItemSheet({
  open,
  onOpenChange,
  householdId,
  listId,
  item,
  sortOrder,
}: ItemSheetProps) {
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [price, setPrice] = useState(centsToInputValue(item.unitPriceCents))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    if (name.trim().length === 0) return
    setSaving(true)
    try {
      await saveGroceryItem(
        householdId,
        {
          id: item.id,
          listId,
          name,
          quantity: quantity || null,
          checked: item.checked,
          unitPriceCents: parseDollarsToCents(price),
          sortOrder,
        },
        item.revision,
      )
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteGroceryItem(householdId, item.id, item.revision)
      setConfirmDelete(false)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Edit item">
      <div className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="item-name">
            Name
          </label>
          <input
            id="item-name"
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="item-qty">
              Quantity
            </label>
            <input
              id="item-qty"
              className={fieldClass}
              value={quantity}
              placeholder="e.g. 2"
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="item-price">
              Price (CAD)
            </label>
            <input
              id="item-price"
              className={fieldClass}
              inputMode="decimal"
              value={price}
              placeholder="0.00"
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1 rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setConfirmDelete(true)}
            className="rounded-[var(--hh-radius-control)] px-4 py-2.5 font-medium text-[var(--hh-danger)]"
          >
            Delete
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete item?"
        description="This removes the item from the list."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}
