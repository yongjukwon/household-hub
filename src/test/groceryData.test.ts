import { describe, expect, it } from 'vitest'

import {
  cheapestPriceHistory,
  groceryNameSuggestions,
  sortGroceryItems,
  type GroceryItem,
  type PriceHistoryEntry,
} from '@/features/groceries/data'

function item(overrides: Partial<GroceryItem>): GroceryItem {
  return {
    id: crypto.randomUUID(),
    listId: crypto.randomUUID(),
    name: 'Item',
    quantity: null,
    checked: false,
    checkedAt: null,
    unitPriceCents: null,
    sortOrder: 0,
    revision: 1,
    ...overrides,
  }
}

function price(
  priceCents: number,
  overrides: Partial<PriceHistoryEntry> = {},
): PriceHistoryEntry {
  return {
    id: crypto.randomUUID(),
    itemNameNormalized: 'eggs',
    itemName: 'Eggs',
    priceCents,
    recordedAt: '2026-07-20T00:00:00Z',
    listName: 'Market',
    ...overrides,
  }
}

describe('sortGroceryItems', () => {
  it('places checked items newest purchase first', () => {
    const result = sortGroceryItems([
      item({
        name: 'Older',
        checked: true,
        checkedAt: '2026-07-20T00:00:00Z',
      }),
      item({
        name: 'Newer',
        checked: true,
        checkedAt: '2026-07-25T00:00:00Z',
      }),
    ])

    expect(result.checked.map((entry) => entry.name)).toEqual([
      'Newer',
      'Older',
    ])
  })

  it('keeps unchecked items in their explicit list order', () => {
    const result = sortGroceryItems([
      item({ name: 'Second', sortOrder: 2 }),
      item({ name: 'First', sortOrder: 1 }),
    ])

    expect(result.unchecked.map((entry) => entry.name)).toEqual([
      'First',
      'Second',
    ])
  })
})

describe('cheapestPriceHistory', () => {
  it('returns the five cheapest matching records in ascending price order', () => {
    const history = [
      price(599),
      price(449),
      price(349),
      price(499),
      price(429),
      price(398),
      price(299, { itemNameNormalized: 'milk', itemName: 'Milk' }),
    ]

    expect(cheapestPriceHistory(history, 'eggs')).toEqual([
      expect.objectContaining({ priceCents: 349 }),
      expect.objectContaining({ priceCents: 398 }),
      expect.objectContaining({ priceCents: 429 }),
      expect.objectContaining({ priceCents: 449 }),
      expect.objectContaining({ priceCents: 499 }),
    ])
  })
})

describe('groceryNameSuggestions', () => {
  it('deduplicates names household-wide without losing useful casing', () => {
    expect(
      groceryNameSuggestions(
        [{ name: 'Milk' }, { name: 'eggs' }, { name: '  MILK ' }],
        [
          price(399, {
            itemNameNormalized: 'eggs',
            itemName: 'Eggs',
          }),
          price(250, {
            itemNameNormalized: 'bread',
            itemName: 'Sourdough Bread',
          }),
        ],
      ),
    ).toEqual(['eggs', 'Milk', 'Sourdough Bread'])
  })
})
