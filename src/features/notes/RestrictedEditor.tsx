import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline'
import type { RichNoteDocument } from '@household-hub/domain'
import { useDebouncedCallback } from 'use-debounce'
import './editor.css'

const ONCHANGE_DEBOUNCE_MS = 800

interface RestrictedEditorProps {
  /** Restricted TenTap-compatible doc. Initial value; later prop changes
   * (e.g. a realtime refetch) are re-synced while idle, matching the
   * legacy editor's conflict-safe behavior. */
  content: RichNoteDocument
  /** Called with the full doc, debounced; not fired per keystroke. */
  onChange: (document: RichNoteDocument) => void
  placeholder?: string
}

/**
 * Note editor restricted to body, Heading 1-3, bullet/numbered/checklists,
 * undo, and redo — the shared subset `isRichNoteJson` validates and both
 * web (Tiptap) and native (TenTap) render.
 */
export function RestrictedEditor({
  content,
  onChange,
  placeholder = 'Start writing…',
}: RestrictedEditorProps) {
  const debouncedOnChange = useDebouncedCallback((doc: RichNoteDocument) => {
    onChange(doc)
  }, ONCHANGE_DEBOUNCE_MS)

  const editor = useEditor({
    enableInputRules: false,
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
        underline: false,
        dropcursor: false,
        gapcursor: false,
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      debouncedOnChange(editor.getJSON() as RichNoteDocument)
    },
  })

  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      isH1: ctx.editor?.isActive('heading', { level: 1 }) ?? false,
      isH2: ctx.editor?.isActive('heading', { level: 2 }) ?? false,
      isH3: ctx.editor?.isActive('heading', { level: 3 }) ?? false,
      isBulletList: ctx.editor?.isActive('bulletList') ?? false,
      isOrderedList: ctx.editor?.isActive('orderedList') ?? false,
      isTaskList: ctx.editor?.isActive('taskList') ?? false,
      canUndo: ctx.editor?.can().undo() ?? false,
      canRedo: ctx.editor?.can().redo() ?? false,
    }),
  })

  // Flush any pending debounced onChange on unmount so the last edit isn't lost.
  useEffect(() => {
    return () => {
      debouncedOnChange.flush()
    }
  }, [debouncedOnChange])

  // External-update re-sync: skipped while focused or an edit is unsaved, so
  // a realtime refetch can never clobber in-progress typing.
  useEffect(() => {
    if (!editor || editor.isFocused || debouncedOnChange.isPending()) return
    if (JSON.stringify(content) === JSON.stringify(editor.getJSON())) return
    editor.commands.setContent(content, { emitUpdate: false })
  }, [content, editor, debouncedOnChange])

  if (!editor) return null

  return (
    <div className="flex flex-col-reverse md:flex-col">
      <div className="flex flex-wrap items-center gap-1 border-t border-[var(--hh-line)] bg-[var(--hh-surface)] p-2 md:border-b md:border-t-0">
        <ToolbarButton
          label="Body"
          active={!state.isH1 && !state.isH2 && !state.isH3}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          P
        </ToolbarButton>
        <ToolbarButton
          label="Heading 1"
          active={state.isH1}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={state.isH2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={state.isH3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={state.isBulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListBulletIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={state.isOrderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          label="Checklist"
          active={state.isTaskList}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          ☑
        </ToolbarButton>
        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton
            label="Undo"
            disabled={!state.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <ArrowUturnLeftIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            disabled={!state.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <ArrowUturnRightIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>
      <EditorContent editor={editor} className="hh-note-content flex-1 px-1 py-3" />
    </div>
  )
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={
        'flex h-8 min-w-8 items-center justify-center rounded-[var(--hh-radius-control)] px-2 text-sm font-semibold disabled:opacity-30 ' +
        (active
          ? 'bg-[var(--hh-accent)] text-white'
          : 'text-[var(--hh-ink)] hover:bg-[var(--hh-surface-2)]')
      }
    >
      {children}
    </button>
  )
}
