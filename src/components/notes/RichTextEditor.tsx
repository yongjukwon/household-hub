import { useEffect } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useDebouncedCallback } from 'use-debounce'
import { FormatToolbar } from './FormatToolbar'
import './editor.css'

const ONCHANGE_DEBOUNCE_MS = 800

interface RichTextEditorProps {
  /** Initial Tiptap JSON doc. Initial-value only — later prop changes are
   * not re-synced into the editor (external-update reconciliation is a
   * later phase). */
  content: JSONContent
  /** Called with the full doc, debounced; not fired per keystroke. */
  onChange: (json: JSONContent) => void
  placeholder?: string
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing…',
}: RichTextEditorProps) {
  const debouncedOnChange = useDebouncedCallback((json: JSONContent) => {
    onChange(json)
  }, ONCHANGE_DEBOUNCE_MS)

  const editor = useEditor({
    // Click/tap-toolbar-only by design (see the plan): typed Markdown
    // shorthand is explicitly rejected, and bullet/blockquote have no
    // toolbar escape hatch, so StarterKit's Markdown input rules (typing
    // "# ", "**x**", "- ", "> " auto-formatting) must not run. Paste rules
    // are left enabled — pasting already-rich/markdown text should still
    // format, only *typing* shorthand shouldn't.
    enableInputRules: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      debouncedOnChange(editor.getJSON())
    },
  })

  // Flush any pending debounced onChange on unmount so the last edit isn't
  // lost on navigation (e.g. away from the page before the 800ms window
  // elapses).
  useEffect(() => {
    return () => {
      debouncedOnChange.flush()
    }
  }, [debouncedOnChange])

  return (
    <div className="flex flex-col-reverse md:flex-col">
      <FormatToolbar editor={editor} />
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  )
}
