import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/hooks/useHousehold'
import type { Enums, Json, Tables, TablesInsert } from '@/types/database'

export type PageRow = Tables<'pages'>
type PageSection = Enums<'page_section'>
type PageTemplate = Enums<'page_template'>

// RLS scopes reads/writes to the signed-in user's household automatically
// (see supabase/migrations/20260711001811_core.sql, "household rw" policy):
// no explicit household_id filter needed in selects, matching useHousehold.
export function usePages(section: PageSection) {
  return useQuery({
    queryKey: ['pages', section],
    queryFn: async (): Promise<PageRow[]> => {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('section', section)
        .eq('archived', false)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function usePage(pageId: string, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && !!pageId
  return useQuery({
    queryKey: ['page', pageId],
    enabled,
    queryFn: async (): Promise<PageRow> => {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('id', pageId)
        .single()

      if (error) throw error
      return data
    },
  })
}

export interface CreatePageInput {
  section: PageSection
  template: PageTemplate
  title: string
  /** Optional page date range (used by Trip pages for the trip period). */
  startDate?: string | null
  endDate?: string | null
}

export function useCreatePage() {
  const queryClient = useQueryClient()
  const { data: household } = useHousehold()

  return useMutation({
    mutationFn: async ({
      section,
      template,
      title,
      startDate = null,
      endDate = null,
    }: CreatePageInput): Promise<PageRow> => {
      if (!household) {
        throw new Error('No household found for the signed-in user.')
      }

      // created_by is server-derived (trg_pages_created_by trigger always
      // overwrites it with auth.uid()) and never sent from the client. The
      // generated Insert type still marks it required — it has no column
      // default, only a trigger — so the cast below is the documented
      // escape hatch for that gap, not a way to smuggle a real value in.
      const { data, error } = await supabase
        .from('pages')
        .insert({
          household_id: household.id,
          section,
          template,
          title,
          start_date: startDate,
          end_date: endDate,
        } as unknown as TablesInsert<'pages'>)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pages', variables.section] })
    },
  })
}

export interface UpdatePageDatesInput {
  pageId: string
  startDate: string | null
  endDate: string | null
}

// Updates a page's date range (the Trip period). Caches the returned row and
// invalidates the section list, like useRenamePage; the pages Realtime
// subscription refreshes the partner.
export function useUpdatePageDates() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      pageId,
      startDate,
      endDate,
    }: UpdatePageDatesInput): Promise<PageRow> => {
      const { data, error } = await supabase
        .from('pages')
        .update({ start_date: startDate, end_date: endDate })
        .eq('id', pageId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['page', data.id], data)
      queryClient.invalidateQueries({ queryKey: ['pages', data.section] })
    },
  })
}

export interface UpdatePageContentInput {
  pageId: string
  content: Json
}

// Per-page monotonic save sequence + request chain. Two debounced
// autosaves for the SAME page (a slow network reordering them, or two
// tabs/instances editing at once) must never let an older PUT of the whole
// `content` doc land on the server after a newer one, and an older
// response resolving late must never clobber the cache with stale content
// once it does arrive. Module-level (not a ref) and keyed by pageId, since
// the guard needs to hold across the whole app for a given page, not just
// within one component instance.
//
// Two mechanisms, both required:
// 1. `chain` — each save's actual request is queued behind the previous
//    save's request settling, so the server only ever sees one in-flight
//    write per page, in issue order. This is what prevents out-of-order
//    writes at the network level.
// 2. `seq` — an incrementing counter tagging each save. onSuccess only
//    writes through setQueryData when the resolving save is still the
//    most recent one issued for that page — a belt-and-braces guard in
//    case that ordering assumption is ever broken elsewhere.
const pageSaveState = new Map<
  string,
  { seq: number; chain: Promise<unknown> }
>()

function getPageSaveState(pageId: string) {
  let state = pageSaveState.get(pageId)
  if (!state) {
    state = { seq: 0, chain: Promise.resolve() }
    pageSaveState.set(pageId, state)
  }
  return state
}

// Debounced autosave target for RichTextEditor's onChange (NotesPageView).
// Deliberately does NOT invalidate ['page', pageId]: a refetch racing a
// focused editor could clobber in-progress typing. setQueryData with the
// returned row keeps that cache entry current instead. The section-list
// invalidation uses the *returned row's* section (not a section passed in
// or re-derived from the URL) so the "Edited …" meta refreshes correctly
// regardless of caller context.
export function useUpdatePageContent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      pageId,
      content,
    }: UpdatePageContentInput): Promise<{ data: PageRow; seq: number }> => {
      const state = getPageSaveState(pageId)
      const seq = ++state.seq
      const previous = state.chain

      // Queue the real request behind the previous save's request
      // settling (ignoring its outcome — a failed prior save shouldn't
      // block this one, just order after it).
      const request = previous
        .catch(() => undefined)
        .then(async () => {
          const { data, error } = await supabase
            .from('pages')
            .update({ content })
            .eq('id', pageId)
            .select()
            .single()

          if (error) throw error
          return data as PageRow
        })

      state.chain = request.catch(() => undefined)

      const data = await request
      return { data, seq }
    },
    onSuccess: ({ data, seq }) => {
      const state = getPageSaveState(data.id)
      if (state.seq === seq) {
        queryClient.setQueryData(['page', data.id], data)
      }
      queryClient.invalidateQueries({ queryKey: ['pages', data.section] })
    },
  })
}

export interface RenamePageInput {
  pageId: string
  title: string
}

// Renames a page. Invalidates both the single-page key and the section list
// (the list shows titles) using the RETURNED row's section, so the caller
// doesn't have to pass or re-derive it — same reasoning as
// useUpdatePageContent. The pages Realtime subscription refreshes the
// partner's view.
export function useRenamePage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ pageId, title }: RenamePageInput): Promise<PageRow> => {
      const { data, error } = await supabase
        .from('pages')
        .update({ title })
        .eq('id', pageId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['page', data.id], data)
      queryClient.invalidateQueries({ queryKey: ['pages', data.section] })
    },
  })
}

// Hard delete: the design's context menu says "Delete page" with no undo.
// The `archived` column exists for future use but stays unused here — no
// archive UI in this task.
export function useDeletePage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('pages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] })
    },
  })
}
