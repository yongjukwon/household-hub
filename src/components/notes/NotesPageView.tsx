import type { JSONContent } from '@tiptap/react'
import { RichTextEditor } from './RichTextEditor'
import { useUpdatePageContent, type PageRow } from '@/hooks/usePages'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'
import type { Json } from '@/types/database'

interface NotesPageViewProps {
  page: PageRow
}

// Bounded/scrollable layout, mobile only (below the `md` breakpoint
// FormatToolbar itself switches on for bottom- vs top-docking — matching
// the app shell's own mobile/desktop split, e.g. BottomNav/MobileBackBar
// and AppShell's `pb-20`, which all switch at `md` too; `sm` would flip
// this layout to desktop-mode as early as 640px, top-docking the toolbar
// against unbounded scroll while the shell chrome around it is still in
// its mobile layout — the exact keyboard-docking failure this bound
// exists to prevent): the wrapper's height is the viewport minus the fixed
// mobile chrome around it (MobileBackBar ~3rem + BottomNav's reserved
// pb-20 clearance ~5rem, both from AppShell), and the editor sits in its
// own `overflow-y-auto` region inside that bound. That inner div becomes
// the nearest scrolling ancestor for FormatToolbar's `sticky bottom-0`, so
// the toolbar docks to the visible bottom of a container that actually
// resizes with `dvh` when the on-screen keyboard opens — sticking it
// against unbounded document scroll would leave it able to end up below
// the fold behind the keyboard. Above `md`, the toolbar docks to the top
// instead (no keyboard concern), so the bound is lifted and the page
// returns to normal document flow.
export function NotesPageView({ page }: NotesPageViewProps) {
  const updateContent = useUpdatePageContent()
  // Remote edits to this page (the partner saving from their device) refetch
  // ['page', id]; RichTextEditor re-syncs the new content only while the
  // editor is neither focused nor holding an unsaved debounced edit.
  useRealtimeTable('pages', 'id', page.id, ['page', page.id])

  function handleChange(json: JSONContent) {
    updateContent.mutate({ pageId: page.id, content: json as unknown as Json })
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-2xl flex-col px-4 pt-6 md:h-auto md:px-8 md:pt-10">
      <div className="flex shrink-0 items-center justify-between gap-3 pb-4">
        <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
          {page.title}
        </h1>
        {updateContent.isPending && (
          <span role="status" className="text-sm text-[var(--meta)]">
            Saving…
          </span>
        )}
      </div>

      {updateContent.isError && (
        <p role="alert" className="mb-2 shrink-0 text-sm text-[var(--danger)]">
          Couldn’t save — retrying isn’t automatic yet
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto md:overflow-visible">
        <RichTextEditor
          content={page.content as unknown as JSONContent}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
