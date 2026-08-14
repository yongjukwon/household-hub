import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import GroceryListScreen from '../../../app/(tabs)/groceries/[listId]'
import { useActiveHousehold } from '@/features/household'
import { saveProfileSettings, useProfile } from '@/features/settings/profile'
import { saveGroceryItem, toggleGroceryItem } from './mutations'
import { useGroceryList, useGroceryLists, type GroceryItem, type PriceHistoryEntry } from './data'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ listId: LIST_ID }),
}))

jest.mock('@/features/household', () => ({ useActiveHousehold: jest.fn() }))
jest.mock('./data', () => {
  const actual = jest.requireActual('./data')
  return { ...actual, useGroceryList: jest.fn(), useGroceryLists: jest.fn() }
})
jest.mock('./mutations', () => {
  const actual = jest.requireActual('./mutations')
  return {
    ...actual,
    saveGroceryItem: jest.fn(),
    toggleGroceryItem: jest.fn(),
  }
})
jest.mock('@/features/settings/profile', () => ({
  useProfile: jest.fn(),
  saveProfileSettings: jest.fn(),
}))

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111'
const LIST_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '99999999-9999-4999-8999-999999999999'

const pricedItem: GroceryItem = {
  id: '33333333-3333-4333-8333-333333333333',
  listId: LIST_ID,
  name: 'Milk',
  quantity: '2',
  checked: false,
  checkedAt: null,
  unitPriceCents: 250,
  purchaseQuantity: 2,
  totalPriceCents: 500,
  purchaseOccurrenceId: null,
  sortOrder: 0,
  revision: 1,
}

const unpricedItem: GroceryItem = {
  ...pricedItem,
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Eggs',
  quantity: null,
  unitPriceCents: null,
  purchaseQuantity: null,
  totalPriceCents: null,
  sortOrder: 1,
}

const history: PriceHistoryEntry[] = [
  {
    id: '55555555-5555-4555-8555-555555555555',
    itemNameNormalized: 'milk',
    itemName: 'Milk',
    priceCents: 250,
    recordedAt: '2026-08-10T18:00:00Z',
    listName: 'Save-On-Foods',
    purchaseQuantity: 2,
    totalPriceCents: 500,
    sourceItemId: pricedItem.id,
    purchaseOccurrenceId: '66666666-6666-4666-8666-666666666666',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    itemNameNormalized: 'eggs',
    itemName: 'Eggs',
    priceCents: 400,
    recordedAt: '2026-08-09T18:00:00Z',
    listName: 'Costco',
    purchaseQuantity: 3,
    totalPriceCents: 1200,
    sourceItemId: unpricedItem.id,
    purchaseOccurrenceId: '88888888-8888-4888-8888-888888888888',
  },
]

const mockedHousehold = useActiveHousehold as jest.MockedFunction<typeof useActiveHousehold>
const mockedList = useGroceryList as jest.MockedFunction<typeof useGroceryList>
const mockedLists = useGroceryLists as jest.MockedFunction<typeof useGroceryLists>
const mockedProfile = useProfile as jest.MockedFunction<typeof useProfile>
const mockedSaveItem = saveGroceryItem as jest.MockedFunction<typeof saveGroceryItem>
const mockedToggleItem = toggleGroceryItem as jest.MockedFunction<typeof toggleGroceryItem>
const mockedSaveProfile = saveProfileSettings as jest.MockedFunction<typeof saveProfileSettings>

async function renderScreen() {
  return await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      <GroceryListScreen />
    </SafeAreaProvider>,
  )
}

function mockItems(items: GroceryItem[], entries = history) {
  mockedList.mockReturnValue({
    data: { items, history: entries, knowledgeItems: items },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useGroceryList>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockedHousehold.mockReturnValue({
    data: { id: HOUSEHOLD_ID, name: 'Rabbit and Penguin', members: [] },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  mockedLists.mockReturnValue({
    data: [{ id: LIST_ID, name: 'Save-On-Foods', sortOrder: 0, revision: 1 }],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useGroceryLists>)
  mockedProfile.mockReturnValue({
    data: {
      userId: USER_ID,
      displayName: 'Yongju',
      appearance: 'system',
      notificationsEnabled: true,
      mobileNavigation: ['groceries', 'ledger', 'trips'],
      suppressUnpricedPurchaseWarning: false,
      revision: 3,
    },
  } as unknown as ReturnType<typeof useProfile>)
  mockItems([pricedItem, unpricedItem])
  mockedSaveItem.mockResolvedValue({ status: 'queued', operationId: crypto.randomUUID() })
  mockedToggleItem.mockResolvedValue({ status: 'queued', operationId: crypto.randomUUID() })
  mockedSaveProfile.mockResolvedValue({ status: 'queued', operationId: crypto.randomUUID() })
})

describe('Grocery purchase flow', () => {
  it('adds a name without showing or sending a price', async () => {
    await renderScreen()

    expect(screen.queryByLabelText('Item price')).toBeNull()
    await fireEvent.changeText(screen.getByLabelText('Item name'), 'Bread')
    await fireEvent(screen.getByLabelText('Item name'), 'submitEditing')

    await waitFor(() => expect(mockedSaveItem).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      expect.objectContaining({
        name: 'Bread',
        unitPriceCents: null,
        purchaseQuantity: null,
        totalPriceCents: null,
        purchaseOccurrenceId: null,
      }),
      null,
    ))
  })

  it('checks a priced item immediately without opening purchase entry', async () => {
    await renderScreen()

    await fireEvent.press(screen.getByLabelText('Check Milk'))

    await waitFor(() => expect(mockedToggleItem).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      pricedItem,
      true,
    ))
    expect(screen.queryByText('Purchase Milk')).toBeNull()
  })

  it('opens purchase entry for an unpriced item and calculates unit price', async () => {
    await renderScreen()

    await fireEvent.press(screen.getByLabelText('Check Eggs'))
    expect(screen.getByText('Purchase Eggs')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Purchase quantity'), '2.5')
    await fireEvent.changeText(screen.getByLabelText('Purchase price'), '12.50')
    await fireEvent.press(screen.getByText('Save price and check'))

    await waitFor(() => expect(mockedSaveItem).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      expect.objectContaining({
        id: unpricedItem.id,
        checked: true,
        quantity: '2.5',
        purchaseQuantity: 2.5,
        totalPriceCents: 1250,
        unitPriceCents: 500,
        purchaseOccurrenceId: expect.any(String),
      }),
      unpricedItem.revision,
    ))
  })

  it('keeps purchase entry open and shows a save failure', async () => {
    mockedSaveItem.mockRejectedValueOnce(new Error('Purchase could not be saved.'))
    await renderScreen()

    await fireEvent.press(screen.getByLabelText('Check Eggs'))
    await fireEvent.changeText(screen.getByLabelText('Purchase price'), '4.99')
    await fireEvent.press(screen.getByText('Save price and check'))

    expect(await screen.findByText('Purchase could not be saved.')).toBeOnTheScreen()
    expect(screen.getByText('Purchase Eggs')).toBeOnTheScreen()
  })

  it('waits for warning suppression to synchronize before checking without price', async () => {
    let releasePreference!: (value: Awaited<ReturnType<typeof saveProfileSettings>>) => void
    mockedSaveProfile.mockReturnValue(new Promise((resolve) => { releasePreference = resolve }))
    await renderScreen()

    await fireEvent.press(screen.getByLabelText('Check Eggs'))
    await fireEvent.press(screen.getByText('Check without price'))
    expect(screen.getByText('This purchase will not enter price history.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByText(/Don’t show this warning again/))
    await fireEvent.press(screen.getAllByText('Check without price')[1])

    expect(mockedSaveProfile).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      USER_ID,
      { suppressUnpricedPurchaseWarning: true },
      3,
    )
    expect(mockedToggleItem).not.toHaveBeenCalled()

    releasePreference({ status: 'queued', operationId: crypto.randomUUID() })
    await waitFor(() => expect(mockedToggleItem).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      unpricedItem,
      true,
    ))
  })

  it('skips only the warning when the profile preference suppresses it', async () => {
    mockedProfile.mockReturnValue({
      data: {
        userId: USER_ID,
        displayName: 'Yongju',
        appearance: 'system',
        notificationsEnabled: true,
        mobileNavigation: ['groceries', 'ledger', 'trips'],
        suppressUnpricedPurchaseWarning: true,
        revision: 3,
      },
    } as unknown as ReturnType<typeof useProfile>)
    await renderScreen()

    await fireEvent.press(screen.getByLabelText('Check Eggs'))
    expect(screen.getByText('Purchase Eggs')).toBeOnTheScreen()
    await fireEvent.press(screen.getByText('Check without price'))

    await waitFor(() => expect(mockedToggleItem).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      unpricedItem,
      true,
    ))
    expect(screen.queryByText('This purchase will not enter price history.')).toBeNull()
    expect(mockedSaveProfile).not.toHaveBeenCalled()
  })

  it('does not check the item when warning suppression fails to synchronize', async () => {
    mockedSaveProfile.mockRejectedValueOnce(new Error('Preference could not be saved.'))
    await renderScreen()

    await fireEvent.press(screen.getByLabelText('Check Eggs'))
    await fireEvent.press(screen.getByText('Check without price'))
    await fireEvent.press(screen.getByText(/Don’t show this warning again/))
    await fireEvent.press(screen.getAllByText('Check without price')[1])

    expect(await screen.findByText('Preference could not be saved.')).toBeOnTheScreen()
    expect(mockedToggleItem).not.toHaveBeenCalled()
    expect(screen.getByText('This purchase will not enter price history.')).toBeOnTheScreen()
  })

  it('renders one history panel immediately after its item and replaces it on expansion', async () => {
    const view = await renderScreen()

    await fireEvent.press(screen.getByLabelText('Price history for Milk'))
    expect(screen.getByText('Price history · Milk')).toBeOnTheScreen()
    expect(screen.getByText('$2.50 each')).toBeOnTheScreen()
    expect(screen.getByText('2 · $5.00 total')).toBeOnTheScreen()
    expect(screen.getByText(/Save-On-Foods ·/)).toBeOnTheScreen()
    const visibleText = view.container
      .queryAll((node) => node.type === 'Text')
      .map((node) => textContent(node.props.children))
    const milkIndex = visibleText.findIndex((value) => value.startsWith('Milk'))
    const historyIndex = visibleText.indexOf('Price history · Milk')
    const eggsIndex = visibleText.findIndex((value) => value.startsWith('Eggs'))
    expect(milkIndex).toBeLessThan(historyIndex)
    expect(historyIndex).toBeLessThan(eggsIndex)

    await fireEvent.press(screen.getByLabelText('Price history for Eggs'))
    expect(screen.queryByText('Price history · Milk')).toBeNull()
    expect(screen.getByText('Price history · Eggs')).toBeOnTheScreen()
    expect(screen.getByText('$4.00 each')).toBeOnTheScreen()
    expect(screen.getByText('3 · $12.00 total')).toBeOnTheScreen()
    expect(screen.getByText(/Costco ·/)).toBeOnTheScreen()
  })
})

function textContent(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(textContent).join('')
  if (value && typeof value === 'object' && 'props' in value) {
    return textContent((value as { props: { children?: unknown } }).props.children)
  }
  return ''
}
