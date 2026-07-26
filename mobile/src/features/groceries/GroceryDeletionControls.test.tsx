import { render } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import GroceryListScreen from '../../../app/(tabs)/groceries/[listId]'
import { useActiveHousehold } from '@/features/household'
import { ItemSheet } from './ItemSheet'
import { useGroceryList, useGroceryLists } from './data'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    listId: '22222222-2222-4222-8222-222222222222',
  }),
  useRouter: () => ({ replace: jest.fn() }),
}))

jest.mock('@/features/household', () => ({
  useActiveHousehold: jest.fn(),
}))

jest.mock('./data', () => {
  const actual = jest.requireActual('./data')
  return {
    ...actual,
    useGroceryList: jest.fn(),
    useGroceryLists: jest.fn(),
  }
})

const mockedHousehold = useActiveHousehold as jest.MockedFunction<
  typeof useActiveHousehold
>
const mockedList = useGroceryList as jest.MockedFunction<typeof useGroceryList>
const mockedLists = useGroceryLists as jest.MockedFunction<typeof useGroceryLists>

const item = {
  id: '33333333-3333-4333-8333-333333333333',
  listId: '22222222-2222-4222-8222-222222222222',
  name: 'Milk',
  quantity: null,
  checked: false,
  checkedAt: null,
  unitPriceCents: 499,
  sortOrder: 0,
  revision: 1,
}

function provider(children: React.ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}
    >
      {children}
    </SafeAreaProvider>
  )
}

beforeEach(() => {
  mockedHousehold.mockReturnValue({
    data: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Rabbit and Penguin',
      members: [],
    },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  mockedLists.mockReturnValue({
    data: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Save-on-food',
        sortOrder: 0,
        revision: 1,
      },
    ],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useGroceryLists>)
  mockedList.mockReturnValue({
    data: { items: [item], history: [], knowledgeItems: [item] },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useGroceryList>)
})

describe('Grocery deletion controls', () => {
  it('uses the list-index trash action instead of a detail-page Delete button', async () => {
    const view = await render(provider(<GroceryListScreen />))

    expect(view.queryByText('Delete')).toBeNull()
    expect(view.getByLabelText('Delete Milk')).toBeOnTheScreen()
  })

  it('uses the item-row trash action instead of a duplicate editor Delete button', async () => {
    const view = await render(
      provider(
        <ItemSheet
          open
          onOpenChange={jest.fn()}
          householdId="11111111-1111-4111-8111-111111111111"
          listId="22222222-2222-4222-8222-222222222222"
          item={item}
          sortOrder={0}
        />,
      ),
    )

    expect(view.getByText('Save')).toBeOnTheScreen()
    expect(view.queryByText('Delete')).toBeNull()
  })
})
