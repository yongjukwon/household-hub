import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { formatMoney } from '@household-hub/domain'
import { Screen } from '@/shell/Screen'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import { useActiveHousehold } from '@/features/household'
import { parseDollarsToCents } from '@/features/moneyInput'
import {
  latestPriceByName,
  normalizeItemName,
  useGroceryList,
  useGroceryLists,
  type GroceryItem,
} from './data'
import {
  clearCheckedItems,
  deleteGroceryList,
  saveGroceryItem,
  toggleGroceryItem,
} from './mutations'
import { ItemSheet } from './ItemSheet'

/** Grocery list detail: items, checked handling, prices, and price history. */
export function GroceryListScreen() {
  const { listId } = useParams<{ listId: string }>()
  const navigate = useNavigate()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const lists = useGroceryLists(householdId)
  const list = lists.data?.find((l) => l.id === listId)
  const query = useGroceryList(householdId, listId)

  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [editing, setEditing] = useState<GroceryItem | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDeleteList, setConfirmDeleteList] = useState(false)
  const [busy, setBusy] = useState(false)

  const items = query.data?.items ?? []
  const latest = useMemo(
    () => latestPriceByName(query.data?.history ?? []),
    [query.data],
  )
  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  // Price recall: if the typed name matches a known item, surface its last price.
  const suggestion = newName.trim()
    ? latest.get(normalizeItemName(newName))
    : undefined

  async function addItem() {
    if (!householdId || !listId || newName.trim().length === 0) return
    setBusy(true)
    try {
      await saveGroceryItem(
        householdId,
        {
          id: crypto.randomUUID(),
          listId,
          name: newName,
          quantity: null,
          checked: false,
          unitPriceCents: parseDollarsToCents(newPrice),
          sortOrder: items.length,
        },
        null,
      )
      setNewName('')
      setNewPrice('')
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    if (!householdId) return
    setBusy(true)
    try {
      await clearCheckedItems(householdId, items)
      setConfirmClear(false)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteList() {
    if (!householdId || !list) return
    setBusy(true)
    try {
      await deleteGroceryList(householdId, list.id, list.revision)
      navigate('/groceries')
    } finally {
      setBusy(false)
    }
  }

  const backAndMenu = (
    <div className="flex items-center gap-2">
      {checked.length > 0 && (
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          className="rounded-[var(--hh-radius-control)] px-3 py-1.5 text-sm font-medium text-[var(--hh-muted)]"
        >
          Clear checked
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirmDeleteList(true)}
        className="rounded-[var(--hh-radius-control)] px-3 py-1.5 text-sm font-medium text-[var(--hh-danger)]"
      >
        Delete
      </button>
    </div>
  )

  return (
    <Screen title={list?.name ?? 'List'} action={backAndMenu}>
      <Link
        to="/groceries"
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--hh-muted)]"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        All lists
      </Link>

      <div className="mb-4 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 shadow-[var(--hh-shadow-card)]">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]"
            placeholder="Add an item"
            aria-label="Item name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addItem()
            }}
          />
          <input
            className="w-24 rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]"
            placeholder="$"
            aria-label="Item price"
            inputMode="decimal"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addItem()
            }}
          />
        </div>
        {suggestion && (
          <p className="mt-2 text-xs text-[var(--hh-muted)]">
            Last time: {formatMoney(suggestion.priceCents, 'CAD')}
          </p>
        )}
      </div>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message="Could not load items." onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="Empty list" hint="Add your first item above." />
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2">
            {unchecked.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                householdId={householdId!}
                onEdit={() => setEditing(item)}
              />
            ))}
          </ul>

          {checked.length > 0 && (
            <div>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--hh-muted)]">
                Checked ({checked.length})
              </h3>
              <ul className="space-y-2">
                {checked.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    householdId={householdId!}
                    onEdit={() => setEditing(item)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {editing && householdId && listId && (
        <ItemSheet
          key={`${editing.id}:${editing.revision}`}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          householdId={householdId}
          listId={listId}
          item={editing}
          sortOrder={editing.sortOrder}
        />
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear checked items?"
        description="This permanently removes the checked items from this list."
        confirmLabel="Clear"
        onConfirm={() => void handleClear()}
      />
      <ConfirmDialog
        open={confirmDeleteList}
        onOpenChange={setConfirmDeleteList}
        title="Delete this list?"
        description="This removes the list and all its items. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void handleDeleteList()}
      />
      {busy && <span className="sr-only" role="status">Working…</span>}
    </Screen>
  )
}

function ItemRow({
  item,
  householdId,
  onEdit,
}: {
  item: GroceryItem
  householdId: string
  onEdit: () => void
}) {
  return (
    <li className="flex items-center gap-3 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 shadow-[var(--hh-shadow-card)]">
      <input
        type="checkbox"
        checked={item.checked}
        aria-label={`Check ${item.name}`}
        onChange={(e) => void toggleGroceryItem(householdId, item, e.target.checked)}
        className="h-5 w-5 accent-[var(--hh-accent)]"
      />
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-1 items-center justify-between gap-2 text-left"
      >
        <span
          className={
            'font-medium ' +
            (item.checked
              ? 'text-[var(--hh-muted)] line-through'
              : 'text-[var(--hh-ink)]')
          }
        >
          {item.name}
          {item.quantity && (
            <span className="ml-2 text-sm text-[var(--hh-muted)]">×{item.quantity}</span>
          )}
        </span>
        {item.unitPriceCents !== null && (
          <span className="text-sm tabular-nums text-[var(--hh-muted)]">
            {formatMoney(item.unitPriceCents, 'CAD')}
          </span>
        )}
      </button>
    </li>
  )
}
