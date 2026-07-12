import { useRef, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useDebounce } from 'use-debounce'
import type { PageRow } from '@/hooks/usePages'
import {
  groceryKeys,
  normalizeItemName,
  useClearCheckedGroceryItems,
  useCreateGroceryItem,
  useDeleteGroceryItem,
  useGroceryItems,
  useGroceryPriceHistory,
  useUpdateGroceryItem,
  type GroceryItem,
} from '@/hooks/useGroceries'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DeleteDialog } from '@/components/common/DeleteDialog'
import { EditableTitle } from '@/components/pages/EditableTitle'
import { GroceryItemRow } from './GroceryItemRow'
import { GroceryItemDialog } from './GroceryItemDialog'

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'CAD',
})

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

const EMPTY_ITEMS: GroceryItem[] = []

interface GroceryPageViewProps {
  page: PageRow
}

export function GroceryPageView({ page }: GroceryPageViewProps) {
  const [name, setName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<GroceryItem | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const createId = useRef<string | null>(null)

  const itemsQuery = useGroceryItems(page.id)
  useRealtimeTable('grocery_items', 'page_id', page.id, groceryKeys.items(page.id))
  // History rows are appended by the price trigger; the prefix covers both
  // the last-seen hint and any open popover's per-name entries.
  useRealtimeTable(
    'grocery_price_history',
    'page_id',
    page.id,
    groceryKeys.history(page.id),
  )
  const createItem = useCreateGroceryItem()
  const updateItem = useUpdateGroceryItem()
  const deleteItem = useDeleteGroceryItem()
  const clearChecked = useClearCheckedGroceryItems()

  // "Last seen $X" hint for the name being typed, debounced so the history
  // query isn't refired per keystroke.
  const [debouncedName] = useDebounce(normalizeItemName(name), 300)
  const lastSeenQuery = useGroceryPriceHistory(page.id, debouncedName, {
    limit: 1,
  })
  const lastSeen = lastSeenQuery.data?.[0] ?? null

  const items = itemsQuery.data ?? EMPTY_ITEMS
  const checkedCount = items.filter((item) => item.checked).length

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    createId.current ??= crypto.randomUUID()
    setAddError(null)
    try {
      await createItem.mutateAsync({
        id: createId.current,
        pageId: page.id,
        name: trimmedName,
        sortOrder: nextSortOrder(items),
      })
      createId.current = null
      setName('')
    } catch (mutationError) {
      console.error('Failed to add grocery item', mutationError)
      setAddError(
        'Couldn’t add this item — check your connection and try again.',
      )
    }
  }

  function toggle(item: GroceryItem) {
    setToggleError(null)
    updateItem.mutate(
      { id: item.id, pageId: page.id, checked: !item.checked },
      {
        onError: (mutationError) => {
          console.error('Failed to toggle grocery item', mutationError)
          setToggleError(
            'Couldn’t update this item — check your connection and try again.',
          )
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <EditableTitle page={page} />
          <p className="mt-1 text-sm text-[var(--meta)]">Grocery list</p>
        </div>
        {checkedCount > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmingClear(true)}
          >
            <Trash2 data-icon="inline-start" />
            Clear checked
          </Button>
        )}
      </header>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(event) => void handleAdd(event)}
      >
        <label htmlFor="grocery-add" className="sr-only">
          Add grocery item
        </label>
        <Input
          id="grocery-add"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add an item…"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={createItem.isPending || !name.trim()}
        >
          <Plus data-icon="inline-start" />
          Add
        </Button>
      </form>
      {lastSeen && name.trim() && (
        <p className="mt-2 text-xs text-[var(--meta)]" role="status">
          Last seen: {formatCurrency(lastSeen.price)}
        </p>
      )}
      {addError && (
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
          {addError}
        </p>
      )}
      {toggleError && (
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
          {toggleError}
        </p>
      )}

      {itemsQuery.isPending ? (
        <p
          role="status"
          className="mt-16 text-center text-sm text-[var(--meta)]"
        >
          Loading groceries…
        </p>
      ) : itemsQuery.isError ? (
        <div className="mt-12 text-center">
          <p role="alert" className="text-sm text-[var(--danger)]">
            Couldn’t load this list — check your connection and try again.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void itemsQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-16 text-center text-sm text-[var(--meta)]">
          Nothing on the list yet — add the first item above.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[var(--line2)] rounded-xl border border-[var(--line2)] bg-[var(--panel)] px-4">
          {items.map((item) => (
            <GroceryItemRow
              key={item.id}
              pageId={page.id}
              item={item}
              formatCurrency={formatCurrency}
              onToggle={toggle}
              onEdit={setEditingItem}
              onDelete={setDeletingItem}
            />
          ))}
        </ul>
      )}

      {editingItem && (
        <GroceryItemDialog
          key={editingItem.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditingItem(null)
          }}
          pageId={page.id}
          item={editingItem}
        />
      )}
      <DeleteDialog
        open={!!deletingItem}
        onOpenChange={(open) => {
          if (!open) setDeletingItem(null)
        }}
        title="Delete item?"
        description={
          deletingItem
            ? `“${deletingItem.name}” will be removed from the list. Its price history is kept.`
            : ''
        }
        onConfirm={async () => {
          if (!deletingItem) return
          await deleteItem.mutateAsync({
            id: deletingItem.id,
            pageId: page.id,
          })
        }}
      />
      <DeleteDialog
        open={confirmingClear}
        onOpenChange={setConfirmingClear}
        title="Clear checked items?"
        description={`${checkedCount} checked ${checkedCount === 1 ? 'item' : 'items'} will be removed from the list. Price history is kept.`}
        onConfirm={async () => {
          await clearChecked.mutateAsync({
            pageId: page.id,
            ids: items.filter((item) => item.checked).map((item) => item.id),
          })
        }}
      />
    </div>
  )
}

function nextSortOrder(items: GroceryItem[]): number {
  return items.reduce(
    (maximum, item) => Math.max(maximum, item.sort_order + 1),
    0,
  )
}
