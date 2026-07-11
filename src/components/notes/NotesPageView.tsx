import type { JSONContent } from '@tiptap/react'
import { RichTextEditor } from './RichTextEditor'
import { useUpdatePageContent, type PageRow } from '@/hooks/usePages'
import type { Json } from '@/types/database'

interface NotesPageViewProps {
  page: PageRow
}

// Bounded/scrollable layout, mobile only (below the `sm` breakpoint
// FormatToolbar itself switches on for bottom- vs top-docking): the
// wrapper's height is the viewport minus the fixed mobile chrome around it
// (MobileBackBar ~3rem + BottomNav's reserved pb-20 clearance ~5rem, both
// from AppShell), and the editor sits in its own `overflow-y-auto` region
// inside that bound. That inner div becomes the nearest scrolling ancestor
// for FormatToolbar's `sticky bottom-0`, so the toolbar docks to the
// visible bottom of a container that actually resizes with `dvh` when the
// on-screen keyboard opens — sticking it against unbounded document scroll
// would leave it able to end up below the fold behind the keyboard. Above
// `sm`, the toolbar docks to the top instead (no keyboard concern), so the
// bound is lifted and the page returns to normal document flow.
export function NotesPageView({ page }: NotesPageViewProps) {
  const updateContent = useUpdatePageContent()

  function handleChange(json: JSONContent) {
    updateContent.mutate({ pageId: page.id, content: json as unknown as Json })
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-2xl flex-col px-4 pt-6 sm:h-auto md:px-8 md:pt-10">
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

      <div className="min-h-0 flex-1 overflow-y-auto sm:overflow-visible">
        <RichTextEditor
          content={page.content as unknown as JSONContent}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
