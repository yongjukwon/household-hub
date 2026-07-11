import { useParams } from 'react-router-dom'
import { sectionFromPath } from '@/components/layout/nav-items'
import { usePage } from '@/hooks/usePages'
import { NotesPageView } from '@/components/notes/NotesPageView'

// Routes by the page's own `template`, not the URL section: every 'blank'
// page (all notes-section pages) gets the Tiptap editor via NotesPageView.
// The other templates ('budget', 'trip', 'grocery') keep the placeholder
// body — their dedicated views are Phases 2-4.
export default function PageView() {
  const { section, pageId } = useParams<{ section: string; pageId: string }>()
  const knownSection = section ? sectionFromPath(`/${section}`) : undefined
  const { data: page, isPending, isError } = usePage(pageId ?? '')

  if (!knownSection) return <PageNotFound />
  if (isPending) return null
  if (isError || !page) return <PageNotFound />

  if (page.template === 'blank') return <NotesPageView page={page} />

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
        {page.title}
      </h1>
      <p className="mt-6 text-sm text-[var(--meta)]">Editor coming soon</p>
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
