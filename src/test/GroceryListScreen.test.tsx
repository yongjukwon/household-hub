import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GroceryListScreen } from '@/features/groceries/GroceryListScreen'
import { useActiveHousehold } from '@/features/household'
import * as data from '@/features/groceries/data'
import * as mutations from '@/features/groceries/mutations'
import type { GroceryItem } from '@/features/groceries/data'

vi.mock('@/features/household', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/household')>()),
  useActiveHousehold: vi.fn(),
}))
vi.mock('@/features/groceries/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/groceries/data')>()),
  useGroceryLists: vi.fn(),
  useGroceryList: vi.fn(),
}))
vi.mock('@/features/groceries/mutations', () => ({
  saveGroceryList: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
  saveGroceryItem: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
  toggleGroceryItem: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
  deleteGroceryItem: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
  deleteGroceryList: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
  clearCheckedItems: vi.fn().mockResolvedValue(undefined),
}))

const HH = '11111111-1111-1111-1111-111111111111'
const LIST = '22222222-2222-2222-2222-222222222222'

function item(over: Partial<GroceryItem>): GroceryItem {
  return {
    id: crypto.randomUUID(),
    listId: LIST,
    name: 'Milk',
    quantity: null,
    checked: false,
    checkedAt: null,
    unitPriceCents: 450,
    sortOrder: 0,
    revision: 1,
    ...over,
  }
}

beforeEach(() => {
  vi.mocked(useActiveHousehold).mockReturnValue({
    data: { id: HH, name: 'Home', members: [] },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  vi.mocked(data.useGroceryLists).mockReturnValue({
    data: [{ id: LIST, name: 'Costco', sortOrder: 0, revision: 1 }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof data.useGroceryLists>)
})

function setList(
  items: GroceryItem[],
  history: data.PriceHistoryEntry[] = [],
  knowledgeItems: data.GroceryKnowledgeItem[] = items,
) {
  vi.mocked(data.useGroceryList).mockReturnValue({
    data: { items, history, knowledgeItems },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof data.useGroceryList>)
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={[`/groceries/${LIST}`]}>
      <Routes>
        <Route path="/groceries/:listId" element={<GroceryListScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('GroceryListScreen', () => {
  it('renders the list name and its items with prices', () => {
    setList([item({ name: 'Milk', unitPriceCents: 450 })])
    renderScreen()
    expect(screen.getByText('Costco')).toBeInTheDocument()
    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('$4.50')).toBeInTheDocument()
  })

  it('separates checked items under a Checked heading', () => {
    setList([item({ name: 'Milk' }), item({ name: 'Eggs', checked: true })])
    renderScreen()
    expect(screen.getByText(/Checked \(1\)/)).toBeInTheDocument()
  })

  it('toggles an item when its checkbox is clicked', async () => {
    const milk = item({ name: 'Milk', checked: false })
    setList([milk])
    renderScreen()
    await userEvent.click(screen.getByLabelText('Check Milk'))
    expect(mutations.toggleGroceryItem).toHaveBeenCalledWith(HH, milk, true)
  })

  it('adds an item with a parsed CAD price on Enter', async () => {
    setList([])
    renderScreen()
    await userEvent.type(screen.getByLabelText('Item name'), 'Bread')
    await userEvent.type(screen.getByLabelText('Item price'), '3.25{enter}')
    expect(mutations.saveGroceryItem).toHaveBeenCalledWith(
      HH,
      expect.objectContaining({ name: 'Bread', unitPriceCents: 325, checked: false }),
      null,
    )
  })

  it('surfaces the last recorded price for a known item name', async () => {
    setList(
      [],
      [
        {
          id: 'h1',
          itemNameNormalized: 'milk',
          itemName: 'Milk',
          priceCents: 499,
          recordedAt: '2026-07-01T00:00:00Z',
          listName: 'Costco',
        },
      ],
    )
    renderScreen()
    await userEvent.type(screen.getByLabelText('Item name'), 'Milk')
    expect(screen.getByText('Last time: $4.99')).toBeInTheDocument()
  })

  it('renames the list through the shared inline title editor', async () => {
    setList([])
    renderScreen()

    await userEvent.click(
      screen.getByRole('button', { name: 'Grocery list name' }),
    )
    const input = screen.getByRole('textbox', { name: 'Grocery list name' })
    await userEvent.clear(input)
    await userEvent.type(input, 'Market{enter}')

    expect(mutations.saveGroceryList).toHaveBeenCalledWith(
      HH,
      { id: LIST, name: 'Market', sortOrder: 0, revision: 1 },
      1,
    )
  })

  it('offers household-wide item names and recalls the selected price', async () => {
    setList(
      [],
      [
        {
          id: 'history-bread',
          itemNameNormalized: 'sourdough bread',
          itemName: 'Sourdough Bread',
          priceCents: 529,
          recordedAt: '2026-07-20T00:00:00Z',
          listName: 'Market',
        },
      ],
      [{ name: 'Sourdough Bread' }],
    )
    renderScreen()

    await userEvent.type(screen.getByRole('combobox', { name: 'Item name' }), 'sour')
    await userEvent.click(
      screen.getByRole('option', { name: 'Sourdough Bread' }),
    )

    expect(screen.getByRole('combobox', { name: 'Item name' })).toHaveValue(
      'Sourdough Bread',
    )
    expect(screen.getByLabelText('Item price')).toHaveValue('5.29')
  })

  it('shows purchase dates and sorts checked items newest first', () => {
    setList([
      item({
        name: 'Older',
        checked: true,
        checkedAt: '2026-07-20T12:00:00Z',
      }),
      item({
        name: 'Newer',
        checked: true,
        checkedAt: '2026-07-25T12:00:00Z',
      }),
    ])
    renderScreen()

    const newer = screen.getByText('Newer')
    const older = screen.getByText('Older')
    expect(
      newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText(/Purchased Jul 25, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Purchased Jul 20, 2026/)).toBeInTheDocument()
  })

  it('opens the five cheapest item history with store names and dates', async () => {
    const prices = [599, 349, 499, 398, 449, 429].map((priceCents, index) => ({
      id: `h-${priceCents}`,
      itemNameNormalized: 'eggs',
      itemName: 'Eggs',
      priceCents,
      recordedAt: `2026-07-${String(index + 10).padStart(2, '0')}T00:00:00Z`,
      listName: index % 2 === 0 ? 'Costco' : 'Market',
    }))
    setList([item({ name: 'Eggs', unitPriceCents: 599 })], prices)
    renderScreen()

    await userEvent.click(screen.getByText('Eggs'))

    const history = screen.getByRole('region', {
      name: 'Price history for Eggs',
    })
    expect(history).toHaveTextContent('$3.49')
    expect(history).toHaveTextContent('$3.98')
    expect(history).toHaveTextContent('$4.29')
    expect(history).toHaveTextContent('$4.49')
    expect(history).toHaveTextContent('$4.99')
    expect(history).not.toHaveTextContent('$5.99')
    expect(history).toHaveTextContent(/Costco|Market/)
    expect(history).toHaveTextContent(/Jul/)
  })
})
