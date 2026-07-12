import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GroceryPageView } from '@/components/groceries/GroceryPageView'
import {
  useClearCheckedGroceryItems,
  useCreateGroceryItem,
  useDeleteGroceryItem,
  useGroceryItems,
  useGroceryNameSuggestions,
  useGroceryPriceHistory,
  useUpdateGroceryItem,
} from '@/hooks/useGroceries'

vi.mock('@/hooks/useGroceries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useGroceries')>()
  return {
    ...actual,
    useGroceryItems: vi.fn(),
    useGroceryPriceHistory: vi.fn(),
    useGroceryNameSuggestions: vi.fn(),
    useCreateGroceryItem: vi.fn(),
    useUpdateGroceryItem: vi.fn(),
    useDeleteGroceryItem: vi.fn(),
    useClearCheckedGroceryItems: vi.fn(),
  }
})

vi.mock('@/hooks/useRealtimeTable', () => ({
  useRealtimeTable: vi.fn(),
}))

vi.mock('@/components/pages/EditableTitle', () => ({
  EditableTitle: ({ page }: { page: { title: string } }) => (
    <h1>{page.title}</h1>
  ),
}))

const mockUseGroceryItems = vi.mocked(useGroceryItems)
const mockUseGroceryPriceHistory = vi.mocked(useGroceryPriceHistory)
const mockUseGroceryNameSuggestions = vi.mocked(useGroceryNameSuggestions)
const mockUseCreateGroceryItem = vi.mocked(useCreateGroceryItem)
const mockUseUpdateGroceryItem = vi.mocked(useUpdateGroceryItem)
const mockUseDeleteGroceryItem = vi.mocked(useDeleteGroceryItem)
const mockUseClearCheckedGroceryItems = vi.mocked(useClearCheckedGroceryItems)

const refetchItems = vi.fn()
const createItem = vi.fn()
const updateItem = vi.fn()
const deleteItem = vi.fn()
const clearChecked = vi.fn()

const page = {
  id: 'page-1',
  household_id: 'household-1',
  section: 'grocery' as const,
  template: 'grocery' as const,
  title: 'Costco',
  content: { type: 'doc', content: [] },
  created_by: 'user-1',
  archived: false,
  start_date: null,
  end_date: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

const milk = {
  id: 'item-milk',
  household_id: 'household-1',
  page_id: 'page-1',
  name: 'Milk',
  name_normalized: 'milk',
  checked: false,
  last_price: 5.49,
  sort_order: 0,
  created_at: '2026-07-11T18:00:00.000Z',
  updated_at: '2026-07-11T18:00:00.000Z',
}

const bread = {
  ...milk,
  id: 'item-bread',
  name: 'Bread',
  name_normalized: 'bread',
  checked: true,
  last_price: null,
  sort_order: 1,
}

function queryResult(
  data: unknown,
  options: { isPending?: boolean; isError?: boolean } = {},
) {
  return {
    data,
    isPending: options.isPending ?? false,
    isError: options.isError ?? false,
    refetch: refetchItems,
  }
}

function setItems(
  items: unknown[] = [],
  options: { isPending?: boolean; isError?: boolean } = {},
) {
  mockUseGroceryItems.mockReturnValue(queryResult(items, options) as never)
}

function setHistory(records: unknown[] = []) {
  mockUseGroceryPriceHistory.mockReturnValue(
    queryResult(records, { isPending: false }) as never,
  )
}

function setSuggestions(names: string[] = []) {
  mockUseGroceryNameSuggestions.mockReturnValue(
    queryResult(names, { isPending: false }) as never,
  )
}

describe('GroceryPageView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setItems()
    setHistory()
    setSuggestions()
    mockUseCreateGroceryItem.mockReturnValue({
      isPending: false,
      mutateAsync: createItem,
    } as never)
    mockUseUpdateGroceryItem.mockReturnValue({
      isPending: false,
      mutate: updateItem,
      mutateAsync: updateItem,
    } as never)
    mockUseDeleteGroceryItem.mockReturnValue({
      mutateAsync: deleteItem,
    } as never)
    mockUseClearCheckedGroceryItems.mockReturnValue({
      mutateAsync: clearChecked,
    } as never)
  })

  it('renders loading and retryable error states', () => {
    setItems([], { isPending: true })
    const { unmount } = render(<GroceryPageView page={page} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading groceries…')
    unmount()

    setItems([], { isError: true })
    render(<GroceryPageView page={page} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      /couldn.t load this list/i,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetchItems).toHaveBeenCalledOnce()
  })

  it('adds an item through the inline form with a client-generated id (no price)', async () => {
    const user = userEvent.setup()
    createItem.mockResolvedValue(milk)
    render(<GroceryPageView page={page} />)

    await user.type(screen.getByLabelText('Add grocery item'), 'Milk')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(createItem).toHaveBeenCalledWith({
      id: expect.stringMatching(/[0-9a-f-]{36}/),
      pageId: 'page-1',
      name: 'Milk',
      sortOrder: 0,
      lastPrice: null,
    })
  })

  it('adds an item with a price entered in the same row', async () => {
    const user = userEvent.setup()
    createItem.mockResolvedValue(milk)
    render(<GroceryPageView page={page} />)

    await user.type(screen.getByLabelText('Add grocery item'), 'Milk')
    await user.type(screen.getByLabelText('Price (optional)'), '5.49')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(createItem).toHaveBeenCalledWith({
      id: expect.stringMatching(/[0-9a-f-]{36}/),
      pageId: 'page-1',
      name: 'Milk',
      sortOrder: 0,
      lastPrice: 5.49,
    })
  })

  it('shows the last-seen price hint with the store for the typed name', async () => {
    const user = userEvent.setup()
    setHistory([
      {
        id: 'history-1',
        page_id: 'page-1',
        item_name_normalized: 'milk',
        price: 5.49,
        store: 'Save-On',
        recorded_by: 'user-1',
        recorded_at: '2026-07-01T00:00:00.000Z',
      },
    ])
    render(<GroceryPageView page={page} />)

    await user.type(screen.getByLabelText('Add grocery item'), 'Milk')

    const hint = await screen.findByText(/Last seen:/)
    expect(hint).toHaveTextContent(/5\.49/)
    expect(hint).toHaveTextContent(/Save-On/)
  })

  it('suggests matching item names from anywhere and fills the field on select', async () => {
    const user = userEvent.setup()
    setSuggestions(['Whole Milk', 'Milk Chocolate', 'Eggs'])
    render(<GroceryPageView page={page} />)

    const input = screen.getByLabelText('Add grocery item')
    await user.type(input, 'milk')

    // Both milk names match; Eggs does not.
    const wholeMilk = await screen.findByRole('button', { name: 'Whole Milk' })
    expect(wholeMilk).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Milk Chocolate' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Eggs' }),
    ).not.toBeInTheDocument()

    await user.click(wholeMilk)
    expect(input).toHaveValue('Whole Milk')
  })

  it('renders items with prices, toggles a checkbox, and shows Clear checked only when needed', async () => {
    const user = userEvent.setup()
    setItems([milk, bread])
    render(<GroceryPageView page={page} />)

    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText(/5\.49/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Clear checked' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Milk' }))
    expect(updateItem).toHaveBeenCalledWith(
      { id: 'item-milk', pageId: 'page-1', checked: true },
      expect.anything(),
    )
  })

  it('hides Clear checked with no checked items and confirms clearing keeps history', async () => {
    const user = userEvent.setup()
    setItems([milk])
    const { unmount } = render(<GroceryPageView page={page} />)
    expect(
      screen.queryByRole('button', { name: 'Clear checked' }),
    ).not.toBeInTheDocument()
    unmount()

    setItems([milk, bread])
    render(<GroceryPageView page={page} />)
    await user.click(screen.getByRole('button', { name: 'Clear checked' }))
    expect(
      screen.getByRole('heading', { name: 'Clear checked items?' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Price history is kept/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(clearChecked).toHaveBeenCalledWith({
      pageId: 'page-1',
      ids: ['item-bread'],
    })
  })

  it('confirms item deletion via the row menu and notes history is kept', async () => {
    const user = userEvent.setup()
    setItems([milk])
    render(<GroceryPageView page={page} />)

    await user.click(screen.getByRole('button', { name: 'Actions for Milk' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(
      screen.getByRole('heading', { name: 'Delete item?' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/price history is kept/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteItem).toHaveBeenCalledWith({
      id: 'item-milk',
      pageId: 'page-1',
    })
  })

  it('opens the edit dialog from the row menu', async () => {
    const user = userEvent.setup()
    setItems([milk])
    render(<GroceryPageView page={page} />)

    await user.click(screen.getByRole('button', { name: 'Actions for Milk' }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

    expect(
      screen.getByRole('heading', { name: 'Edit item' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Milk')
    expect(screen.getByLabelText('Price')).toHaveValue('5.49')
  })
})
