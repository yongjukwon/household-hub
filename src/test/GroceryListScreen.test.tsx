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

function setList(items: GroceryItem[], history: data.PriceHistoryEntry[] = []) {
  vi.mocked(data.useGroceryList).mockReturnValue({
    data: { items, history },
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
        },
      ],
    )
    renderScreen()
    await userEvent.type(screen.getByLabelText('Item name'), 'Milk')
    expect(screen.getByText('Last time: $4.99')).toBeInTheDocument()
  })
})
