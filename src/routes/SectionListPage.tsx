import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { NavItem } from '@/components/layout/nav-items'
import { PageCard } from '@/components/pages/PageCard'
import { TemplatePicker } from '@/components/pages/TemplatePicker'
import { useDeletePage, usePages } from '@/hooks/usePages'

export default function SectionListPage({ navItem }: { navItem: NavItem }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const { data: pages, isPending, isError } = usePages(navItem.section)
  const deletePage = useDeletePage()
  const [deleteFailed, setDeleteFailed] = useState(false)

  function handleDelete(id: string) {
    setDeleteFailed(false)
    deletePage.mutate(id, {
      onError: () => setDeleteFailed(true),
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <header className="mb-2 flex items-center justify-between">
        <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
          {navItem.label}
        </h1>
        <button
          type="button"
          aria-label={`New ${navItem.label} page`}
          onClick={() => setPickerOpen(true)}
          className="rounded-full p-2 text-[var(--accent)] hover:bg-[var(--hover)]"
        >
          <Plus size={22} />
        </button>
      </header>

      {deleteFailed && (
        <p role="alert" className="mb-4 text-sm text-[var(--danger)]">
          Couldn’t delete the page — check your connection and try again.
        </p>
      )}

      {isError ? (
        <p
          role="alert"
          className="mt-16 text-center text-sm text-[var(--danger)]"
        >
          Couldn’t load pages — check your connection and try again.
        </p>
      ) : pages && pages.length > 0 ? (
        <div>
          {pages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              sectionPath={navItem.path}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        !isPending && (
          <p className="mt-16 text-center text-sm text-[var(--meta)]">
            No pages yet
          </p>
        )
      )}

      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        navItem={navItem}
      />
    </div>
  )
}
