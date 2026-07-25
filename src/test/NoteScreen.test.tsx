import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RichNoteDocument } from '@household-hub/domain'
import { NoteScreen } from '@/features/notes/NoteScreen'
import { useActiveHousehold } from '@/features/household'
import * as data from '@/features/notes/data'
import * as mutations from '@/features/notes/mutations'

vi.mock('@/features/household', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/household')>()),
  useActiveHousehold: vi.fn(),
}))
vi.mock('@/features/notes/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/notes/data')>()),
  useNote: vi.fn(),
}))
vi.mock('@/features/notes/mutations', () => ({
  saveNote: vi.fn(),
  deleteNote: vi.fn(),
}))

const SAVED_DOC: RichNoteDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved body' }] }],
}
const DRAFT_DOC: RichNoteDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft body' }] }],
}
vi.mock('@/features/notes/RestrictedEditor', () => ({
  RestrictedEditor: ({ onChange }: { onChange: (document: RichNoteDocument) => void }) => (
    <button type="button" onClick={() => onChange(DRAFT_DOC)}>
      edit document
    </button>
  ),
}))

const HH = '11111111-1111-4111-8111-111111111111'
const NOTE_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(mutations.saveNote).mockResolvedValue({
    status: 'queued',
    operationId: '11111111-1111-4111-8111-111111111111',
  })
  vi.mocked(mutations.deleteNote).mockResolvedValue({
    status: 'queued',
    operationId: '11111111-1111-4111-8111-111111111111',
  })
  vi.mocked(useActiveHousehold).mockReturnValue({
    data: { id: HH, name: 'Home', members: [] },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  vi.mocked(data.useNote).mockReturnValue({
    data: {
      id: NOTE_ID,
      title: 'Packing list',
      document: SAVED_DOC,
      revision: 3,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof data.useNote>)
})

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={[`/notes/${NOTE_ID}`]}>
      <Routes>
        <Route path="/notes/:noteId" element={<NoteScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NoteScreen', () => {
  it('starts in plain read mode without a title textbox or toolbar', () => {
    renderScreen()
    expect(screen.getByText('Saved body')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Note title' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Heading 1' })).not.toBeInTheDocument()
  })

  it('opens explicit editing from Edit or the title', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('textbox', { name: 'Note title' })).toHaveFocus()
    expect(screen.getByText('edit document')).toBeInTheDocument()
  })

  it('activates the read title to enter editing', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Edit note title' }))
    expect(screen.getByRole('textbox', { name: 'Note title' })).toHaveFocus()
  })

  it('cancels local title and document changes without saving', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const title = screen.getByRole('textbox', { name: 'Note title' })
    await userEvent.clear(title)
    await userEvent.type(title, 'Changed')
    await userEvent.click(screen.getByText('edit document'))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Saved body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit note title' })).toHaveTextContent('Packing list')
    expect(mutations.saveNote).not.toHaveBeenCalled()
  })

  it('saves the complete draft once and returns to read mode', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const title = screen.getByRole('textbox', { name: 'Note title' })
    await userEvent.clear(title)
    await userEvent.type(title, 'Trip packing')
    await userEvent.click(screen.getByText('edit document'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(mutations.saveNote).toHaveBeenCalledTimes(1)
    expect(mutations.saveNote).toHaveBeenCalledWith(
      HH,
      { id: NOTE_ID, title: 'Trip packing', document: DRAFT_DOC },
      3,
    )
    expect(await screen.findByText('Draft body')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Note title' })).not.toBeInTheDocument()
  })

  it('keeps the draft open when the server discards Save', async () => {
    vi.mocked(mutations.saveNote).mockResolvedValueOnce({
      status: 'discarded',
      operationId: '11111111-1111-4111-8111-111111111111',
      discarded: {
        explanation: 'Your partner saved a newer version.',
      },
    } as Awaited<ReturnType<typeof mutations.saveNote>>)
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Your partner saved a newer version.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Note title' })).toBeInTheDocument()
  })

  it('deletes the note after confirmation using the loaded revision', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await userEvent.click(deleteButtons.at(-1)!)
    expect(mutations.deleteNote).toHaveBeenCalledWith(HH, NOTE_ID, 3)
  })
})
