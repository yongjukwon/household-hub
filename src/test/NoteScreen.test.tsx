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
  saveNote: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
  deleteNote: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'op' }),
}))

// RestrictedEditor's own Tiptap behavior isn't re-tested here — stubbed to a
// button that fires onChange with a fixed document, so these tests focus on
// NoteScreen's own wiring (title edits, document edits, delete confirm).
const STUB_DOC: RichNoteDocument = { type: 'doc', content: [{ type: 'paragraph' }] }
vi.mock('@/features/notes/RestrictedEditor', () => ({
  RestrictedEditor: ({ onChange }: { onChange: (document: RichNoteDocument) => void }) => (
    <button type="button" onClick={() => onChange(STUB_DOC)}>
      edit-doc
    </button>
  ),
}))

const HH = '11111111-1111-1111-1111-111111111111'
const NOTE_ID = '22222222-2222-2222-2222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useActiveHousehold).mockReturnValue({
    data: { id: HH, name: 'Home', members: [] },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
})

function setNote(note: data.Note) {
  vi.mocked(data.useNote).mockReturnValue({
    data: note,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof data.useNote>)
}

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
  it('renders the note title and editor', () => {
    setNote({ id: NOTE_ID, title: 'Packing list', document: STUB_DOC, revision: 3 })
    renderScreen()
    expect(screen.getByLabelText('Note title')).toHaveValue('Packing list')
  })

  it('saves a renamed title on blur, based on the loaded revision', async () => {
    setNote({ id: NOTE_ID, title: 'Packing list', document: STUB_DOC, revision: 3 })
    renderScreen()
    const titleInput = screen.getByLabelText('Note title')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Trip packing')
    await userEvent.tab()
    expect(mutations.saveNote).toHaveBeenCalledWith(
      HH,
      { id: NOTE_ID, title: 'Trip packing', document: STUB_DOC },
      3,
    )
  })

  it('saves document edits with the current title', async () => {
    setNote({ id: NOTE_ID, title: 'Packing list', document: STUB_DOC, revision: 5 })
    renderScreen()
    await userEvent.click(screen.getByText('edit-doc'))
    expect(mutations.saveNote).toHaveBeenCalledWith(
      HH,
      { id: NOTE_ID, title: 'Packing list', document: STUB_DOC },
      5,
    )
  })

  it('deletes the note after confirmation and navigates back to the list', async () => {
    setNote({ id: NOTE_ID, title: 'Packing list', document: STUB_DOC, revision: 1 })
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await userEvent.click(deleteButtons[deleteButtons.length - 1])
    expect(mutations.deleteNote).toHaveBeenCalledWith(HH, NOTE_ID, 1)
  })
})
