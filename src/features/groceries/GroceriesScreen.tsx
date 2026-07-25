import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Screen } from '@/shell/Screen'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { EmptyState, ErrorState, LoadingState } from '@/shell/ui/states'
import { useActiveHousehold } from '@/features/household'
import { useGroceryLists } from './data'
import { saveGroceryList } from './mutations'

/** Grocery destination: the index of named lists. */
export function GroceriesScreen() {
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const lists = useGroceryLists(householdId)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function addList() {
    if (!householdId || name.trim().length === 0) return
    setSaving(true)
    try {
      const sortOrder = lists.data?.length ?? 0
      await saveGroceryList(
        householdId,
        { id: crypto.randomUUID(), name, sortOrder },
        null,
      )
      setName('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const addButton = (
    <button
      type="button"
      onClick={() => setAdding(true)}
      aria-label="New list"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hh-accent)] text-white"
    >
      <PlusIcon className="h-5 w-5" />
    </button>
  )

  return (
    <Screen title="Groceries" action={addButton}>
      {lists.isLoading ? (
        <LoadingState />
      ) : lists.isError ? (
        <ErrorState message="Could not load your lists." onRetry={() => void lists.refetch()} />
      ) : (lists.data ?? []).length === 0 ? (
        <EmptyState
          title="No lists yet"
          hint="Create a list to start adding items."
          action={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2 font-medium text-white"
            >
              New list
            </button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {(lists.data ?? []).map((list) => (
            <li key={list.id}>
              <Link
                to={`/groceries/${list.id}`}
                className="flex items-center justify-between rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]"
              >
                <span className="font-medium text-[var(--hh-ink)]">{list.name}</span>
                <ChevronRightIcon className="h-5 w-5 text-[var(--hh-muted)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <BottomSheet open={adding} onOpenChange={setAdding} title="New list">
        <div className="space-y-3">
          <input
            className="w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]"
            placeholder="List name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addList()
            }}
          />
          <button
            type="button"
            disabled={saving || name.trim().length === 0}
            onClick={() => void addList()}
            className="w-full rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            Create
          </button>
        </div>
      </BottomSheet>
    </Screen>
  )
}
