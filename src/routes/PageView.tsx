import { lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { sectionFromPath } from '@/components/layout/nav-items'
import { usePage } from '@/hooks/usePages'
import { NotesPageView } from '@/components/notes/NotesPageView'

const BudgetPageView = lazy(() =>
  import('@/components/budget/BudgetPageView').then((module) => ({
    default: module.BudgetPageView,
  })),
)

// Routes by the page's own `template`, not the URL section: every 'blank'
// page (all notes-section pages) gets the Tiptap editor via NotesPageView.
// The other templates ('budget', 'trip', 'grocery') keep the placeholder
// body — their dedicated views are Phases 2-4.
export default function PageView() {
  const { section, pageId } = useParams<{ section: string; pageId: string }>()
  const knownSection = section ? sectionFromPath(`/${section}`) : undefined
  // Gated on knownSection too, not just pageId: an unknown section (e.g.
  // /garbage/xyz) should render PageNotFound without ever hitting
  // Supabase for a page that can't be reachable through this route anyway.
  const {
    data: page,
    isPending,
    isError,
  } = usePage(pageId ?? '', {
    enabled: !!knownSection,
  })

  if (!knownSection) return <PageNotFound />
  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
        <p className="mt-16 text-center text-sm text-[var(--meta)]">Loading…</p>
      </div>
    )
  }
  if (isError || !page) return <PageNotFound />

  // key={page.id} forces a remount when pageId changes on this shared
  // route: with the target page already cached, usePage never flips
  // isPending, nothing unmounts, and RichTextEditor's initial-value-only
  // useEditor would otherwise keep the previous page's document under the
  // new page's title.
  if (page.template === 'blank') {
    return <NotesPageView key={page.id} page={page} />
  }
  if (page.template === 'budget') {
    return (
      <Suspense fallback={<PageLoading label="Loading budget…" />}>
        <BudgetPageView key={page.id} page={page} />
      </Suspense>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
        {page.title}
      </h1>
      <p className="mt-6 text-sm text-[var(--meta)]">Editor coming soon</p>
    </div>
  )
}

function PageLoading({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <p className="mt-16 text-center text-sm text-[var(--meta)]">{label}</p>
    </div>
  )
}

function PageNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <p className="text-sm text-[var(--meta)]">Page not found.</p>
    </div>
  )
}
