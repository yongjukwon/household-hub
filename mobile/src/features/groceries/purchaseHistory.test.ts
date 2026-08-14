import type { PriceHistoryEntry } from './data'
import {
  PURCHASE_HISTORY_WINDOW_DAYS,
  filterPurchasedItems,
  purchaseStoreLabel,
  purchasedItemSummaries,
  recentPurchasesForItem,
} from './purchaseHistory'

function entry(overrides: Partial<PriceHistoryEntry> = {}): PriceHistoryEntry {
  return {
    id: crypto.randomUUID(),
    itemNameNormalized: 'eggs',
    itemName: 'Eggs',
    priceCents: 400,
    recordedAt: '2026-07-20T00:00:00.000Z',
    listName: 'Save-On-Foods',
    purchaseQuantity: 1,
    totalPriceCents: 400,
    sourceItemId: null,
    purchaseOccurrenceId: null,
    ...overrides,
  }
}

const NOW = new Date('2026-08-13T12:00:00.000Z')

function daysBefore(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('purchasedItemSummaries', () => {
  it('lists one row per distinct item, newest purchase first', () => {
    const summaries = purchasedItemSummaries([
      entry({
        itemNameNormalized: 'eggs',
        itemName: 'Eggs',
        recordedAt: '2026-07-01T00:00:00.000Z',
      }),
      entry({
        itemNameNormalized: 'milk',
        itemName: 'Milk',
        recordedAt: '2026-08-02T00:00:00.000Z',
      }),
      entry({
        itemNameNormalized: 'bread',
        itemName: 'Sourdough Bread',
        recordedAt: '2026-07-15T00:00:00.000Z',
      }),
    ])

    expect(summaries.map((summary) => summary.displayName)).toEqual([
      'Milk',
      'Sourdough Bread',
      'Eggs',
    ])
  })

  it('collapses every list a name was bought on into one row with its newest purchase', () => {
    const summaries = purchasedItemSummaries([
      entry({
        itemName: 'eggs',
        listName: 'Costco',
        recordedAt: '2026-06-01T00:00:00.000Z',
        purchaseQuantity: 12,
        totalPriceCents: 1200,
      }),
      entry({
        itemName: '  EGGS  ',
        listName: 'Save-On-Foods',
        recordedAt: '2026-08-01T00:00:00.000Z',
        purchaseQuantity: 6,
        totalPriceCents: 500,
      }),
    ])

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      normalizedName: 'eggs',
      displayName: 'EGGS',
      lastPurchasedAt: '2026-08-01T00:00:00.000Z',
    })
  })

  it('reports the latest unit price as the exact total-to-quantity ratio', () => {
    const summaries = purchasedItemSummaries([
      entry({
        recordedAt: '2026-08-01T00:00:00.000Z',
        purchaseQuantity: 3,
        totalPriceCents: 1000,
      }),
    ])

    expect(summaries[0].latestUnitPriceCents).toBeCloseTo(1000 / 3, 10)
  })

  it('still names a purchase whose source item and list were deleted', () => {
    const summaries = purchasedItemSummaries([
      entry({
        itemNameNormalized: 'olive oil',
        itemName: '   ',
        listName: '   ',
        sourceItemId: null,
      }),
    ])

    expect(summaries[0].displayName).toBe('olive oil')
    expect(summaries[0].displayName.trim()).not.toBe('')
  })

  it('never renders a blank name even with no usable snapshot at all', () => {
    const summaries = purchasedItemSummaries([
      entry({ itemNameNormalized: '', itemName: '' }),
    ])

    expect(summaries[0].displayName).toBe('Unknown item')
  })
})

describe('filterPurchasedItems', () => {
  const summaries = purchasedItemSummaries([
    entry({
      itemNameNormalized: 'crème fraîche',
      itemName: 'Crème Fraîche',
      recordedAt: '2026-08-01T00:00:00.000Z',
    }),
    entry({
      itemNameNormalized: 'milk',
      itemName: 'Milk',
      recordedAt: '2026-07-01T00:00:00.000Z',
    }),
  ])

  it('returns everything for an empty search', () => {
    expect(filterPurchasedItems(summaries, '   ')).toHaveLength(2)
  })

  it('matches case-insensitively', () => {
    expect(
      filterPurchasedItems(summaries, 'MILK').map((item) => item.displayName),
    ).toEqual(['Milk'])
  })

  it('matches accent-insensitively in both directions', () => {
    expect(
      filterPurchasedItems(summaries, 'creme').map((item) => item.displayName),
    ).toEqual(['Crème Fraîche'])
    expect(
      filterPurchasedItems(summaries, 'FRAÎCHE').map((item) => item.displayName),
    ).toEqual(['Crème Fraîche'])
  })

  it('reports no matches rather than falling back to everything', () => {
    expect(filterPurchasedItems(summaries, 'quinoa')).toEqual([])
  })
})

describe('recentPurchasesForItem', () => {
  it('keeps only the named item, newest occurrence first', () => {
    const recent = recentPurchasesForItem(
      [
        entry({ id: 'older-eggs', recordedAt: daysBefore(20) }),
        entry({ id: 'milk', itemNameNormalized: 'milk', recordedAt: daysBefore(1) }),
        entry({ id: 'newer-eggs', recordedAt: daysBefore(2) }),
      ],
      'eggs',
      NOW,
    )

    expect(recent.map((purchase) => purchase.id)).toEqual([
      'newer-eggs',
      'older-eggs',
    ])
  })

  it('includes a purchase exactly at the window edge and excludes the one past it', () => {
    const recent = recentPurchasesForItem(
      [
        entry({ id: 'edge', recordedAt: daysBefore(PURCHASE_HISTORY_WINDOW_DAYS) }),
        entry({ id: 'stale', recordedAt: daysBefore(PURCHASE_HISTORY_WINDOW_DAYS + 1) }),
      ],
      'eggs',
      NOW,
    )

    expect(recent.map((purchase) => purchase.id)).toEqual(['edge'])
  })

  it('returns nothing when the item was only ever bought before the window', () => {
    const history = [entry({ recordedAt: daysBefore(400) })]

    expect(recentPurchasesForItem(history, 'eggs', NOW)).toEqual([])
    // The item itself stays findable in the searchable list.
    expect(purchasedItemSummaries(history)).toHaveLength(1)
  })

  it('matches the name however the caller cases or pads it', () => {
    const recent = recentPurchasesForItem(
      [entry({ recordedAt: daysBefore(5) })],
      '  EGGS ',
      NOW,
    )

    expect(recent).toHaveLength(1)
  })
})

describe('purchaseStoreLabel', () => {
  it('names the stored list snapshot', () => {
    expect(purchaseStoreLabel(entry({ listName: 'Costco' }))).toBe('Costco')
  })

  it('falls back when the list snapshot is missing', () => {
    expect(purchaseStoreLabel(entry({ listName: '  ' }))).toBe('Unknown list')
  })
})
