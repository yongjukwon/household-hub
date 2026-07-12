import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import Image from '@tiptap/extension-image'
import { FormatToolbar } from '@/components/notes/FormatToolbar'

// Test harness: a real Tiptap editor (same extensions RichTextEditor wires
// up, minus Placeholder which is irrelevant here) driving the toolbar under
// test, with the live editor instance exposed for assertions.
function Harness({
  onReady,
  uploadImage,
}: {
  onReady: (editor: Editor) => void
  uploadImage?: (file: File) => Promise<string>
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      TextStyle,
      Color,
      Image,
    ],
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      ],
    },
  })

  // useEditor creates the instance synchronously (immediatelyRender
  // defaults to true), so it's available from the first render — no effect
  // needed to hand it back to the test.
  onReady(editor)

  return (
    <>
      <FormatToolbar editor={editor} uploadImage={uploadImage} />
      <EditorContent editor={editor} />
    </>
  )
}

function renderHarness(uploadImage?: (file: File) => Promise<string>) {
  let editor!: Editor
  render(<Harness onReady={(e) => (editor = e)} uploadImage={uploadImage} />)
  return () => editor
}

describe('FormatToolbar', () => {
  it('toggles bold on the selection and reflects the active state', async () => {
    const user = userEvent.setup()
    const getEditor = renderHarness()

    getEditor().commands.selectAll()

    const boldButton = screen.getByRole('button', { name: 'Bold' })
    expect(boldButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(boldButton)

    expect(getEditor().isActive('bold')).toBe(true)
    expect(document.querySelector('strong')).not.toBeNull()
    await waitFor(() =>
      expect(boldButton).toHaveAttribute('aria-pressed', 'true'),
    )

    await user.click(boldButton)

    expect(getEditor().isActive('bold')).toBe(false)
    await waitFor(() =>
      expect(boldButton).toHaveAttribute('aria-pressed', 'false'),
    )
  })

  it('switches paragraph tier through the HeadingMenu: paragraph -> Title -> Body', async () => {
    const user = userEvent.setup()
    const getEditor = renderHarness()

    const trigger = screen.getByRole('button', { name: 'Paragraph style' })
    expect(trigger).toHaveTextContent('Body')

    await user.click(trigger)
    await user.click(await screen.findByRole('menuitem', { name: 'Title' }))

    expect(getEditor().isActive('heading', { level: 1 })).toBe(true)
    await waitFor(() => expect(trigger).toHaveTextContent('Title'))

    await user.click(trigger)
    await user.click(await screen.findByRole('menuitem', { name: 'Body' }))

    expect(getEditor().isActive('paragraph')).toBe(true)
    await waitFor(() => expect(trigger).toHaveTextContent('Body'))
  })

  it('toggles the checklist and wraps the line in a task item', async () => {
    const user = userEvent.setup()
    const getEditor = renderHarness()

    const checklistButton = screen.getByRole('button', { name: 'Checklist' })
    expect(checklistButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(checklistButton)

    expect(getEditor().isActive('taskList')).toBe(true)
    expect(document.querySelector('ul[data-type="taskList"]')).not.toBeNull()
    await waitFor(() =>
      expect(checklistButton).toHaveAttribute('aria-pressed', 'true'),
    )
  })

  it('toggles underline and highlight marks on the selection', async () => {
    const user = userEvent.setup()
    const getEditor = renderHarness()
    getEditor().commands.selectAll()

    await user.click(screen.getByRole('button', { name: 'Underline' }))
    expect(getEditor().isActive('underline')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Highlight' }))
    expect(getEditor().isActive('highlight')).toBe(true)
    expect(document.querySelector('mark')).not.toBeNull()
  })

  it('applies center alignment through the alignment menu', async () => {
    const user = userEvent.setup()
    const getEditor = renderHarness()

    await user.click(screen.getByRole('button', { name: 'Text alignment' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Center' }))

    expect(getEditor().isActive({ textAlign: 'center' })).toBe(true)
  })

  it('sets and clears a text color through the color menu', async () => {
    const user = userEvent.setup()
    const getEditor = renderHarness()
    getEditor().commands.selectAll()

    await user.click(screen.getByRole('button', { name: 'Text color' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Blue' }))
    expect(document.querySelector('span[style*="color"]')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Text color' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Default' }))
    expect(getEditor().getAttributes('textStyle').color ?? null).toBeNull()
  })

  it('adds a clickable link to the selection via the link dialog', async () => {
    const user = userEvent.setup()
    const getEditor = renderHarness()
    getEditor().commands.selectAll()

    await user.click(screen.getByRole('button', { name: 'Link' }))
    await user.type(
      await screen.findByLabelText('URL'),
      'https://example.com',
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(getEditor().isActive('link')).toBe(true)
    const anchor = document.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor).toHaveAttribute('href', 'https://example.com')
  })

  it('hides the image button when no uploader is provided', () => {
    renderHarness()
    expect(
      screen.queryByRole('button', { name: 'Insert image' }),
    ).not.toBeInTheDocument()
  })

  it('uploads a picked image and inserts it at the returned URL', async () => {
    const user = userEvent.setup()
    const uploadImage = vi
      .fn()
      .mockResolvedValue('https://cdn.example/note-images/abc.png')
    const getEditor = renderHarness(uploadImage)

    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() =>
      expect(getEditor().getHTML()).toContain(
        'https://cdn.example/note-images/abc.png',
      ),
    )
    expect(uploadImage).toHaveBeenCalledWith(file)
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example/note-images/abc.png',
    )
  })

  it('surfaces an upload failure without inserting an image', async () => {
    const user = userEvent.setup()
    const uploadImage = vi.fn().mockRejectedValue(new Error('Too big'))
    renderHarness(uploadImage)

    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    await user.upload(input, file)

    expect(await screen.findByRole('alert')).toHaveTextContent('Too big')
    expect(document.querySelector('img')).toBeNull()
  })

  it('disables undo until there is history, then enables it after an edit', async () => {
    const user = userEvent.setup()
    const getEditor = renderHarness()

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

    getEditor().commands.selectAll()
    await user.click(screen.getByRole('button', { name: 'Bold' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled(),
    )
  })
})
