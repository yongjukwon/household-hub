import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import {
  Bold,
  ChevronDown,
  Italic,
  ListChecks,
  Strikethrough,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface FormatToolbarProps {
  editor: Editor | null
}

type HeadingTier = 'title' | 'heading' | 'body'

const TIER_LABEL: Record<HeadingTier, string> = {
  title: 'Title',
  heading: 'Heading',
  body: 'Body',
}

// Sticky slim bar: bottom of the editor container on mobile (docked above
// the on-screen keyboard), top bar on desktop. CSS-only breakpoint switch,
// no JS media queries, no text-selection bubble menu (unreliable on
// mobile — deliberately excluded).
const EMPTY_STATE = {
  isBold: false,
  isItalic: false,
  isStrike: false,
  isTaskList: false,
  tier: 'body' as HeadingTier,
}

export function FormatToolbar({ editor }: FormatToolbarProps) {
  const state =
    useEditorState({
      editor,
      selector: ({ editor }) => {
        if (!editor) return EMPTY_STATE
        const tier: HeadingTier = editor.isActive('heading', { level: 1 })
          ? 'title'
          : editor.isActive('heading', { level: 2 })
            ? 'heading'
            : 'body'
        return {
          isBold: editor.isActive('bold'),
          isItalic: editor.isActive('italic'),
          isStrike: editor.isActive('strike'),
          isTaskList: editor.isActive('taskList'),
          tier,
        }
      },
    }) ?? EMPTY_STATE

  if (!editor) return null

  return (
    <div className="sticky bottom-0 z-10 flex items-center gap-1 border-t border-[var(--line2)] bg-[var(--panel)] px-2 py-1 sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b">
      <ToolbarButton
        label="Bold"
        active={state.isBold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.isItalic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={state.isStrike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <HeadingMenu editor={editor} tier={state.tier} />
      <ToolbarButton
        label="Checklist"
        active={state.isTaskList}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks className="size-4" />
      </ToolbarButton>
    </div>
  )
}

function HeadingMenu({ editor, tier }: { editor: Editor; tier: HeadingTier }) {
  function selectTier(next: HeadingTier) {
    const chain = editor.chain().focus()
    if (next === 'title') chain.setHeading({ level: 1 }).run()
    else if (next === 'heading') chain.setHeading({ level: 2 }).run()
    else chain.setParagraph().run()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Paragraph style"
          className="flex h-10 min-w-10 items-center gap-1 rounded-md px-2 text-sm text-[var(--text)] hover:bg-[var(--hover)] sm:h-8"
        >
          {TIER_LABEL[tier]}
          <ChevronDown className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => selectTier('title')}>
          Title
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => selectTier('heading')}>
          Heading
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => selectTier('body')}>
          Body
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-md sm:size-8',
        active
          ? 'bg-[var(--accentSoft)] text-[var(--accent)]'
          : 'text-[var(--text)] hover:bg-[var(--hover)]',
      )}
    >
      {children}
    </button>
  )
}
