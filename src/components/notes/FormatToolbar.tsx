import { useState, type FormEvent } from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Highlighter,
  Italic,
  Link2,
  ListChecks,
  Palette,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

// A small fixed text-color palette (plus "Default" to clear). Values are
// mid-tone hues that stay legible on both the light and dark canvases.
const TEXT_COLORS: Array<{ label: string; value: string }> = [
  { label: 'Red', value: '#ef4444' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Green', value: '#10b981' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#8b5cf6' },
]

// Sticky slim bar: bottom of the editor container on mobile (docked above
// the on-screen keyboard), top bar on desktop. Switches at `md` to match
// the app shell's own mobile/desktop breakpoint. It scrolls horizontally so
// the expanded button set never overflows a narrow phone. No text-selection
// bubble menu (unreliable on mobile — deliberately excluded).
const EMPTY_STATE = {
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrike: false,
  isHighlight: false,
  isTaskList: false,
  isLink: false,
  align: 'left' as 'left' | 'center' | 'right',
  tier: 'body' as HeadingTier,
  canUndo: false,
  canRedo: false,
}

export function FormatToolbar({ editor }: FormatToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false)
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
        const align = editor.isActive({ textAlign: 'center' })
          ? 'center'
          : editor.isActive({ textAlign: 'right' })
            ? 'right'
            : 'left'
        return {
          isBold: editor.isActive('bold'),
          isItalic: editor.isActive('italic'),
          isUnderline: editor.isActive('underline'),
          isStrike: editor.isActive('strike'),
          isHighlight: editor.isActive('highlight'),
          isTaskList: editor.isActive('taskList'),
          isLink: editor.isActive('link'),
          align,
          tier,
          canUndo: editor.can().undo(),
          canRedo: editor.can().redo(),
        }
      },
    }) ?? EMPTY_STATE

  if (!editor) return null

  return (
    <>
      <div className="sticky bottom-0 z-10 flex items-center gap-1 overflow-x-auto border-t border-[var(--line2)] bg-[var(--panel)] px-2 py-1 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
        <ToolbarButton
          label="Undo"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="size-4" />
        </ToolbarButton>
        <Divider />
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
          label="Underline"
          active={state.isUnderline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={state.isStrike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Highlight"
          active={state.isHighlight}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="size-4" />
        </ToolbarButton>
        <ColorMenu editor={editor} />
        <Divider />
        <HeadingMenu editor={editor} tier={state.tier} />
        <AlignMenu editor={editor} align={state.align} />
        <ToolbarButton
          label="Link"
          active={state.isLink}
          onClick={() => setLinkOpen(true)}
        >
          <Link2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Checklist"
          active={state.isTaskList}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListChecks className="size-4" />
        </ToolbarButton>
      </div>
      {linkOpen && (
        <LinkDialog
          editor={editor}
          onOpenChange={setLinkOpen}
          initialHref={editor.getAttributes('link').href ?? ''}
        />
      )}
    </>
  )
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--line2)]" />
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
          className="flex h-10 min-w-10 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-[var(--text)] hover:bg-[var(--hover)] md:h-8"
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

function AlignMenu({ editor, align }: { editor: Editor; align: string }) {
  const Icon =
    align === 'center' ? AlignCenter : align === 'right' ? AlignRight : AlignLeft
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Text alignment"
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-[var(--text)] hover:bg-[var(--hover)] md:size-8"
        >
          <Icon className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="size-4" /> Left
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="size-4" /> Center
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="size-4" /> Right
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ColorMenu({ editor }: { editor: Editor }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Text color"
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-[var(--text)] hover:bg-[var(--hover)] md:size-8"
        >
          <Palette className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {TEXT_COLORS.map((color) => (
          <DropdownMenuItem
            key={color.value}
            onSelect={() => editor.chain().focus().setColor(color.value).run()}
          >
            <span
              aria-hidden
              className="size-4 rounded-full border border-[var(--line2)]"
              style={{ backgroundColor: color.value }}
            />
            {color.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().unsetColor().run()}
        >
          Default
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LinkDialog({
  editor,
  onOpenChange,
  initialHref,
}: {
  editor: Editor
  onOpenChange: (open: boolean) => void
  initialHref: string
}) {
  const [href, setHref] = useState(initialHref)

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = href.trim()
    const chain = editor.chain().focus().extendMarkRange('link')
    if (!trimmed) chain.unsetLink().run()
    else chain.setLink({ href: trimmed }).run()
    onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialHref ? 'Edit link' : 'Add link'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={apply}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editor-link-url">URL</Label>
            <Input
              id="editor-link-url"
              autoFocus
              inputMode="url"
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="https://example.com"
            />
            <p className="text-xs text-[var(--meta)]">
              Leave blank to remove the link.
            </p>
          </div>
          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
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
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-md md:size-8',
        disabled && 'opacity-40',
        active
          ? 'bg-[var(--accentSoft)] text-[var(--accent)]'
          : 'text-[var(--text)] hover:bg-[var(--hover)]',
      )}
    >
      {children}
    </button>
  )
}
