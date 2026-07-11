import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { FormatToolbar } from '@/components/notes/FormatToolbar'

// Test harness: a real Tiptap editor (same extensions RichTextEditor wires
// up, minus Placeholder which is irrelevant here) driving the toolbar under
// test, with the live editor instance exposed for assertions.
function Harness({ onReady }: { onReady: (editor: Editor) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true })],
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
      <FormatToolbar editor={editor} />
      <EditorContent editor={editor} />
    </>
  )
}

function renderHarness() {
  let editor!: Editor
  render(<Harness onReady={(e) => (editor = e)} />)
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
})
