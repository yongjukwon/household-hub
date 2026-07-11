import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/hooks/useHousehold'
import type { Enums, Tables, TablesInsert } from '@/types/database'

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

export function usePage(pageId: string) {
  return useQuery({
    queryKey: ['page', pageId],
    enabled: !!pageId,
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
}

export function useCreatePage() {
  const queryClient = useQueryClient()
  const { data: household } = useHousehold()

  return useMutation({
    mutationFn: async ({
      section,
      template,
      title,
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
