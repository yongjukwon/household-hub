import { enqueueOperation, type EnqueueOutcome } from '@/lib/operations'
import type { GroceryItem } from './data'

/** Create/rename a grocery list. */
export function saveGroceryList(
  householdId: string,
  list: { id: string; name: string; sortOrder: number },
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = { name: list.name.trim(), sortOrder: list.sortOrder }
  return enqueueOperation({
    householdId,
    type: 'grocery.list.upsert',
    entityType: 'grocery_list',
    entityId: list.id,
    baseRevision,
    payload,
    optimistic: payload,
  })
}

/** Delete a grocery list (and, server-side, its items). */
export function deleteGroceryList(
  householdId: string,
  listId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'grocery.list.delete',
    entityType: 'grocery_list',
    entityId: listId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}

export interface GroceryItemInput {
  id: string
  listId: string
  name: string
  quantity: string | null
  checked: boolean
  unitPriceCents: number | null
  sortOrder: number
}

/** Create/edit a grocery item. A positive, changed price appends price history. */
export function saveGroceryItem(
  householdId: string,
  item: GroceryItemInput,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload = {
    listId: item.listId,
    name: item.name.trim(),
    quantity: item.quantity && item.quantity.trim().length > 0 ? item.quantity.trim() : null,
    checked: item.checked,
    unitPriceCents: item.unitPriceCents,
    sortOrder: item.sortOrder,
  }
  return enqueueOperation({
    householdId,
    type: 'grocery.item.upsert',
    entityType: 'grocery_item',
    entityId: item.id,
    baseRevision,
    payload,
    optimistic: payload,
  })
}

/** Toggle an item's checked state, preserving its other fields. */
export function toggleGroceryItem(
  householdId: string,
  item: GroceryItem,
  checked: boolean,
): Promise<EnqueueOutcome> {
  return saveGroceryItem(
    householdId,
    { ...item, checked },
    item.revision,
  )
}

/** Delete a grocery item. */
export function deleteGroceryItem(
  householdId: string,
  itemId: string,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  return enqueueOperation({
    householdId,
    type: 'grocery.item.delete',
    entityType: 'grocery_item',
    entityId: itemId,
    baseRevision,
    payload: {},
    optimistic: null,
  })
}

/** Deletes every checked item in a list (one command per item). */
export async function clearCheckedItems(
  householdId: string,
  items: GroceryItem[],
): Promise<void> {
  const checked = items.filter((i) => i.checked)
  for (const item of checked) {
    await deleteGroceryItem(householdId, item.id, item.revision)
  }
}
