import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotesScreen } from '@/features/notes/NotesScreen'
import { useActiveHousehold } from '@/features/household'
import * as data from '@/features/notes/data'
import * as mutations from '@/features/notes/mutations'

vi.mock('@/features/household', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/household')>()),
  useActiveHousehold: vi.fn(),
}))
vi.mock('@/features/notes/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/notes/data')>()),
  useNotes: vi.fn(),
}))
vi.mock('@/features/notes/mutations', () => ({
  saveNote: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
}))

const HH = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useActiveHousehold).mockReturnValue({
    data: { id: HH, name: 'Home', members: [] },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
})

function setNotes(notes: data.NoteSummary[]) {
  vi.mocked(data.useNotes).mockReturnValue({
    data: notes,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof data.useNotes>)
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <NotesScreen />
    </MemoryRouter>,
  )
}

describe('NotesScreen', () => {
  it('shows the empty state when there are no notes', () => {
    setNotes([])
    renderScreen()
    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('links each note to its detail route', () => {
    setNotes([{ id: 'n1', title: 'Packing list', revision: 1, updatedAt: '2026-07-01T00:00:00.000Z' }])
    renderScreen()
    const link = screen.getByRole('link', { name: /Packing list/ })
    expect(link).toHaveAttribute('href', '/notes/n1')
  })

  it('creates a note with the typed title', async () => {
    setNotes([])
    renderScreen()
    await userEvent.click(screen.getByLabelText('New note'))
    await userEvent.type(screen.getByPlaceholderText('Note title'), 'Recipes')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(mutations.saveNote).toHaveBeenCalledWith(
      HH,
      expect.objectContaining({ title: 'Recipes' }),
      null,
    )
  })
})
