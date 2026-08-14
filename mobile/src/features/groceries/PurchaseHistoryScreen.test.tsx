import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import PurchaseHistoryScreen from '../../../app/purchase-history'
import { useActiveHousehold } from '@/features/household'
import { useHouseholdPurchaseHistory, type PriceHistoryEntry } from './data'

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require('react')
  return {
    __esModule: true,
    Stack: { Screen: () => null },
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
    // Stands in for a focused route. expo-router's real `useFocusEffect` runs
    // the effect immediately when the route is focused and tears it down on
    // dependency change and on unmount (see its `React.useEffect` teardown in
    // expo-router/build/useFocusEffect.js), which is what this reproduces.
    // What it cannot reproduce here is blur/refocus — see the report.
    useFocusEffect: (effect: () => undefined | (() => void)) =>
      useEffect(effect, [effect]),
  }
})

jest.mock('@/features/household', () => ({ useActiveHousehold: jest.fn() }))
jest.mock('./data', () => {
  const actual = jest.requireActual('./data')
  return { ...actual, useHouseholdPurchaseHistory: jest.fn() }
})

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111'
const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

function entry(overrides: Partial<PriceHistoryEntry> = {}): PriceHistoryEntry {
  return {
    id: crypto.randomUUID(),
    itemNameNormalized: 'eggs',
    itemName: 'Eggs',
    priceCents: 400,
    recordedAt: daysAgo(2),
    listName: 'Save-On-Foods',
    purchaseQuantity: 1,
    totalPriceCents: 400,
    sourceItemId: null,
    purchaseOccurrenceId: null,
    ...overrides,
  }
}

const mockedHousehold = useActiveHousehold as jest.MockedFunction<
  typeof useActiveHousehold
>
const mockedHistory = useHouseholdPurchaseHistory as jest.MockedFunction<
  typeof useHouseholdPurchaseHistory
>

function mockHistory(history: PriceHistoryEntry[]) {
  mockedHistory.mockReturnValue({
    data: history,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useHouseholdPurchaseHistory>)
}

async function renderScreen() {
  return await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <PurchaseHistoryScreen />
    </SafeAreaProvider>,
  )
}

const removeSubscription = jest.fn()
let addBackListener: jest.SpiedFunction<typeof BackHandler.addEventListener>

/**
 * Fires the handler the screen currently has registered for the Android
 * hardware Back button, and reports what it told the platform: `true` for
 * "handled, do not pop", `false` for "not mine, let the native stack pop".
 */
async function pressHardwareBack(): Promise<boolean | null | undefined> {
  const registration = addBackListener.mock.calls.at(-1)
  if (!registration) throw new Error('No hardwareBackPress handler is registered.')
  let handled: boolean | null | undefined
  await act(async () => {
    handled = registration[1]({ type: 'hardwareBackPress', timeStamp: 0 })
  })
  return handled
}

beforeEach(() => {
  jest.clearAllMocks()
  addBackListener = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockReturnValue({ remove: removeSubscription })
  mockedHousehold.mockReturnValue({
    data: { id: HOUSEHOLD_ID, name: 'Rabbit and Penguin', members: [] },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  mockHistory([])
})

afterEach(() => {
  addBackListener.mockRestore()
})

describe('Purchase history page', () => {
  it('lists every purchased item once, newest purchase first, with its latest unit price', async () => {
    mockHistory([
      entry({
        itemNameNormalized: 'eggs',
        itemName: 'Eggs',
        recordedAt: daysAgo(30),
        purchaseQuantity: 12,
        totalPriceCents: 600,
      }),
      entry({
        itemNameNormalized: 'eggs',
        itemName: 'Eggs',
        recordedAt: daysAgo(3),
        purchaseQuantity: 3,
        totalPriceCents: 1000,
        listName: 'Costco',
      }),
      entry({
        itemNameNormalized: 'milk',
        itemName: 'Milk',
        recordedAt: daysAgo(1),
        purchaseQuantity: 2,
        totalPriceCents: 500,
      }),
    ])

    await renderScreen()

    const rows = screen.getAllByLabelText(/purchase history$/)
    expect(rows).toHaveLength(2)
    expect(rows[0].props.accessibilityLabel).toBe('Milk purchase history')
    expect(rows[1].props.accessibilityLabel).toBe('Eggs purchase history')
    // Exact ratio 1000/3 rounded only for display.
    expect(screen.getByText('$3.33 each')).toBeTruthy()
    expect(screen.getByText('$2.50 each')).toBeTruthy()
  })

  it('filters the list by name, case- and accent-insensitively', async () => {
    mockHistory([
      entry({ itemNameNormalized: 'crème fraîche', itemName: 'Crème Fraîche' }),
      entry({ itemNameNormalized: 'milk', itemName: 'Milk' }),
    ])

    await renderScreen()
    await fireEvent.changeText(
      screen.getByLabelText('Search purchased items'),
      'CREME',
    )

    expect(screen.getByLabelText('Crème Fraîche purchase history')).toBeTruthy()
    expect(screen.queryByLabelText('Milk purchase history')).toBeNull()
  })

  it('says so when nothing matches the search', async () => {
    mockHistory([entry({ itemNameNormalized: 'milk', itemName: 'Milk' })])

    await renderScreen()
    await fireEvent.changeText(
      screen.getByLabelText('Search purchased items'),
      'quinoa',
    )

    expect(screen.getByText('No matching items')).toBeTruthy()
    expect(screen.queryByLabelText('Milk purchase history')).toBeNull()
  })

  it('says so when the household has never recorded a purchase', async () => {
    mockHistory([])

    await renderScreen()

    expect(screen.getByText('No purchases yet')).toBeTruthy()
  })

  it('opens an item and shows its occurrences from the last 365 days, newest first', async () => {
    mockHistory([
      entry({
        id: 'recent',
        recordedAt: daysAgo(2),
        listName: 'Costco',
        purchaseQuantity: 3,
        totalPriceCents: 1000,
      }),
      entry({
        id: 'older',
        recordedAt: daysAgo(300),
        listName: 'Save-On-Foods',
        purchaseQuantity: 2,
        totalPriceCents: 700,
      }),
      entry({ id: 'stale', recordedAt: daysAgo(400), listName: 'Old Store' }),
    ])

    await renderScreen()
    await fireEvent.press(screen.getByLabelText('Eggs purchase history'))

    expect(screen.getByLabelText('Eggs purchase occurrences')).toBeTruthy()
    const stores = screen.getAllByLabelText(/^Bought at /)
    expect(stores.map((node) => node.props.accessibilityLabel)).toEqual([
      'Bought at Costco',
      'Bought at Save-On-Foods',
    ])
    expect(screen.getByText('3 × $10.00')).toBeTruthy()
    expect(screen.getByText('$3.33 each')).toBeTruthy()
    expect(screen.queryByText('Old Store')).toBeNull()
  })

  it('says so when an item has no purchases inside the 365-day window', async () => {
    mockHistory([entry({ recordedAt: daysAgo(400) })])

    await renderScreen()
    await fireEvent.press(screen.getByLabelText('Eggs purchase history'))

    expect(screen.getByText('No purchases in the last year')).toBeTruthy()
  })

  it('renders purchases whose source item and list are gone', async () => {
    mockHistory([
      entry({
        itemNameNormalized: 'olive oil',
        itemName: '   ',
        listName: '   ',
        sourceItemId: null,
        recordedAt: daysAgo(4),
      }),
    ])

    await renderScreen()

    const row = screen.getByLabelText('olive oil purchase history')
    expect(row).toBeTruthy()

    await fireEvent.press(row)
    expect(screen.getByLabelText('Bought at Unknown list')).toBeTruthy()
  })

  it('returns to the searchable list from an item', async () => {
    mockHistory([entry()])

    await renderScreen()
    await fireEvent.press(screen.getByLabelText('Eggs purchase history'))
    await fireEvent.press(screen.getByLabelText('Back to all items'))

    expect(screen.getByLabelText('Search purchased items')).toBeTruthy()
    expect(screen.getByLabelText('Eggs purchase history')).toBeTruthy()
  })
})

describe('Purchase history Android hardware Back', () => {
  it('registers a hardwareBackPress handler while the page is mounted', async () => {
    mockHistory([entry()])

    await renderScreen()

    expect(addBackListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    )
  })

  it('returns to the item list with the search text intact, instead of leaving the page', async () => {
    mockHistory([entry(), entry({ itemNameNormalized: 'milk', itemName: 'Milk' })])

    await renderScreen()
    await fireEvent.changeText(screen.getByLabelText('Search purchased items'), 'egg')
    await fireEvent.press(screen.getByLabelText('Eggs purchase history'))
    expect(screen.getByLabelText('Eggs purchase occurrences')).toBeTruthy()

    expect(await pressHardwareBack()).toBe(true)

    const search = screen.getByLabelText('Search purchased items')
    expect(search.props.value).toBe('egg')
    expect(screen.getByLabelText('Eggs purchase history')).toBeTruthy()
    expect(screen.queryByLabelText('Milk purchase history')).toBeNull()
    expect(screen.queryByLabelText('Eggs purchase occurrences')).toBeNull()
  })

  it('declines the press when the list is already showing, so the native stack pops the page', async () => {
    mockHistory([entry()])

    await renderScreen()

    expect(await pressHardwareBack()).toBe(false)
    expect(screen.getByLabelText('Search purchased items')).toBeTruthy()
  })

  it('declines again once the item view has been closed', async () => {
    mockHistory([entry()])

    await renderScreen()
    await fireEvent.press(screen.getByLabelText('Eggs purchase history'))
    expect(await pressHardwareBack()).toBe(true)

    expect(await pressHardwareBack()).toBe(false)
  })

  it('removes every subscription it opened, leaving none behind on unmount', async () => {
    mockHistory([entry()])

    const view = await renderScreen()
    await fireEvent.press(screen.getByLabelText('Eggs purchase history'))
    await fireEvent.press(screen.getByLabelText('Back to all items'))
    await act(async () => {
      view.unmount()
    })

    expect(addBackListener).toHaveBeenCalled()
    expect(removeSubscription).toHaveBeenCalledTimes(addBackListener.mock.calls.length)
  })
})
