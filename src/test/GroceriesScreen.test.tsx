import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GroceriesScreen } from '@/features/groceries/GroceriesScreen'
import { useActiveHousehold } from '@/features/household'
import * as data from '@/features/groceries/data'
import * as mutations from '@/features/groceries/mutations'

vi.mock('@/features/household', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/household')>()),
  useActiveHousehold: vi.fn(),
}))
vi.mock('@/features/groceries/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/groceries/data')>()),
  useGroceryLists: vi.fn(),
}))
vi.mock('@/features/groceries/mutations', () => ({
  saveGroceryList: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
}))

const HH = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  vi.mocked(useActiveHousehold).mockReturnValue({
    data: { id: HH, name: 'Home', members: [] },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
})

function setLists(lists: data.GroceryList[]) {
  vi.mocked(data.useGroceryLists).mockReturnValue({
    data: lists,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof data.useGroceryLists>)
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <GroceriesScreen />
    </MemoryRouter>,
  )
}

describe('GroceriesScreen', () => {
  it('shows the empty state when there are no lists', () => {
    setLists([])
    renderScreen()
    expect(screen.getByText('No lists yet')).toBeInTheDocument()
  })

  it('links each list to its detail route', () => {
    setLists([{ id: 'l1', name: 'Costco', sortOrder: 0, revision: 1 }])
    renderScreen()
    const link = screen.getByRole('link', { name: /Costco/ })
    expect(link).toHaveAttribute('href', '/groceries/l1')
  })

  it('creates a list from the add sheet', async () => {
    setLists([])
    renderScreen()
    await userEvent.click(screen.getByLabelText('New list'))
    await userEvent.type(await screen.findByPlaceholderText('List name'), 'Pharmacy')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(mutations.saveGroceryList).toHaveBeenCalledWith(
      HH,
      expect.objectContaining({ name: 'Pharmacy', sortOrder: 0 }),
      null,
    )
  })
})
