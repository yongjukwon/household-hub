import { useEffect } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import Image from '@tiptap/extension-image'
import { useDebouncedCallback } from 'use-debounce'
import { FormatToolbar } from './FormatToolbar'
import './editor.css'

const ONCHANGE_DEBOUNCE_MS = 800

interface RichTextEditorProps {
  /** Tiptap JSON doc. Used as the initial value, and later prop changes
   * (e.g. a realtime refetch after the partner saved) are re-synced into
   * the editor — but only while it is neither focused nor holding an
   * unsaved debounced edit, so remote updates can never clobber
   * in-progress typing (last-write-wins otherwise). */
  content: JSONContent
  /** Called with the full doc, debounced; not fired per keystroke. */
  onChange: (json: JSONContent) => void
  placeholder?: string
  /** Uploads a picked image and resolves its URL. When omitted, the
   * toolbar's image button is hidden (e.g. no household context). */
  uploadImage?: (file: File) => Promise<string>
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing…',
  uploadImage,
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
      // StarterKit v3 bundles Link, Underline and undo/redo history. Link is
      // configured to open on click (so stored URLs are followable) and to
      // only accept safe schemes — never javascript: — since a note's links
      // are rendered as real anchors.
      StarterKit.configure({
        link: {
          openOnClick: true,
          autolink: true,
          protocols: ['http', 'https', 'mailto'],
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      TextStyle,
      Color,
      Image,
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

  // External-update re-sync (Phase 5): when the content prop changes under
  // an idle editor — a realtime refetch delivering the partner's save —
  // replace the document. Skipped while focused or while a debounced local
  // edit is unsaved (the local buffer is newer), and skipped when the
  // incoming doc already matches (our own save echoing back), so the
  // cursor/scroll are never reset spuriously. emitUpdate: false keeps the
  // re-sync from triggering an autosave of its own.
  useEffect(() => {
    if (!editor || editor.isFocused || debouncedOnChange.isPending()) return
    if (JSON.stringify(content) === JSON.stringify(editor.getJSON())) return
    editor.commands.setContent(content, { emitUpdate: false })
  }, [content, editor, debouncedOnChange])

  return (
    <div className="flex flex-col-reverse md:flex-col">
      <FormatToolbar editor={editor} uploadImage={uploadImage} />
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  )
}
