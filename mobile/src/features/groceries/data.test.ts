
import {
  displayedPriceHistory,
  groceryNameSuggestions,
  parsePurchaseQuantity,
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
    purchaseQuantity: null,
    totalPriceCents: null,
    purchaseOccurrenceId: null,
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
    purchaseQuantity: 1,
    totalPriceCents: priceCents,
    sourceItemId: null,
    purchaseOccurrenceId: null,
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

describe('displayedPriceHistory', () => {
  it('returns three cheapest and three most expensive records at six or more', () => {
    const history = [
      price(599),
      price(449),
      price(349),
      price(499),
      price(429),
      price(398),
      price(299, { itemNameNormalized: 'milk', itemName: 'Milk' }),
    ]

    expect(displayedPriceHistory(history, 'eggs')).toEqual([
      expect.objectContaining({ priceCents: 349 }),
      expect.objectContaining({ priceCents: 398 }),
      expect.objectContaining({ priceCents: 429 }),
      expect.objectContaining({ priceCents: 599 }),
      expect.objectContaining({ priceCents: 499 }),
      expect.objectContaining({ priceCents: 449 }),
    ])
  })

  it('shows every matching record once when there are fewer than six', () => {
    const result = displayedPriceHistory([price(300), price(100), price(200)], 'eggs')
    expect(result.map((entry) => entry.priceCents)).toEqual([100, 200, 300])
  })

  it('ranks canonical purchases by their exact total-to-quantity ratio', () => {
    const result = displayedPriceHistory([
      price(100, { id: 'a', totalPriceCents: 1004, purchaseQuantity: 10 }),
      price(100, { id: 'b', totalPriceCents: 1003, purchaseQuantity: 10 }),
      price(100, { id: 'c', totalPriceCents: 1002, purchaseQuantity: 10 }),
      price(100, { id: 'd', totalPriceCents: 1001, purchaseQuantity: 10 }),
      price(100, { id: 'e', totalPriceCents: 2001, purchaseQuantity: 20 }),
      price(100, { id: 'f', totalPriceCents: 1000, purchaseQuantity: 10 }),
    ], 'eggs')

    expect(result.map((entry) => entry.id)).toEqual(['f', 'e', 'd', 'a', 'b', 'c'])
  })
})

describe('parsePurchaseQuantity', () => {
  it('accepts positive decimals and rejects zero, negatives, and malformed input', () => {
    expect(parsePurchaseQuantity('2.5')).toBe(2.5)
    expect(parsePurchaseQuantity('0')).toBeNull()
    expect(parsePurchaseQuantity('-1')).toBeNull()
    expect(parsePurchaseQuantity('two')).toBeNull()
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
