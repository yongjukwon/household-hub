import { useRef, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  useCreateChecklistItem,
  useUpdateChecklistItem,
  type TripChecklistItem,
} from '@/hooks/useTrip'
import { RowMenu } from './ItineraryTab'

interface ChecklistTabProps {
  pageId: string
  items: TripChecklistItem[]
  onEdit: (item: TripChecklistItem) => void
  onDelete: (item: TripChecklistItem) => void
}

export function ChecklistTab({
  pageId,
  items,
  onEdit,
  onDelete,
}: ChecklistTabProps) {
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createId = useRef<string | null>(null)
  const createItem = useCreateChecklistItem()
  const updateItem = useUpdateChecklistItem()

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedLabel = label.trim()
    if (!trimmedLabel) return

    createId.current ??= crypto.randomUUID()
    setError(null)
    try {
      await createItem.mutateAsync({
        id: createId.current,
        pageId,
        label: trimmedLabel,
        sortOrder: nextSortOrder(items),
      })
      createId.current = null
      setLabel('')
    } catch (mutationError) {
      console.error('Failed to add checklist item', mutationError)
      setError('Couldn’t add this item — check your connection and try again.')
    }
  }

  function toggle(item: TripChecklistItem) {
    setError(null)
    updateItem.mutate(
      { id: item.id, pageId, checked: !item.checked },
      {
        onError: (mutationError) => {
          console.error('Failed to toggle checklist item', mutationError)
          setError(
            'Couldn’t update this item — check your connection and try again.',
          )
        },
      },
    )
  }

  return (
    <div>
      <form className="flex gap-2" onSubmit={(event) => void handleAdd(event)}>
        <label htmlFor="checklist-add" className="sr-only">
          Add checklist item
        </label>
        <Input
          id="checklist-add"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Add an item…"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={createItem.isPending || !label.trim()}
        >
          <Plus data-icon="inline-start" />
          Add
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[var(--meta)]">
          Nothing on the checklist yet — add packing and to-do items above.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--line2)] rounded-xl border border-[var(--line2)] bg-[var(--panel)] px-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <Checkbox
                id={`checklist-${item.id}`}
                checked={item.checked}
                onCheckedChange={() => toggle(item)}
                aria-label={item.label}
              />
              <label
                htmlFor={`checklist-${item.id}`}
                className={`min-w-0 flex-1 truncate text-sm ${
                  item.checked
                    ? 'text-[var(--meta)] line-through'
                    : 'text-[var(--text)]'
                }`}
              >
                {item.label}
              </label>
              <RowMenu
                label={`Actions for ${item.label}`}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function nextSortOrder(items: TripChecklistItem[]): number {
  return items.reduce(
    (maximum, item) => Math.max(maximum, item.sort_order + 1),
    0,
  )
}
