export default function SectionListPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
        {title}
      </h1>
      <p className="mt-16 text-center text-sm text-[var(--meta)]">
        No pages yet
      </p>
    </div>
  )
}
