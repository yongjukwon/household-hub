import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export interface HouseholdMember {
  id: string
  userId: string
  displayName: string
}

export interface HouseholdData {
  id: string
  name: string
  members: HouseholdMember[]
}

type HouseholdMemberRow = Pick<
  Tables<'household_members'>,
  'id' | 'user_id' | 'display_name'
> & {
  households: Pick<Tables<'households'>, 'id' | 'name'> | null
}

/**
 * The signed-in user's household, id/name/members. Mirrors the web client's
 * `useHousehold` (same query shape, same one-household-per-user assumption) so
 * every native feature screen has the same single accessor web's Task 6 flows
 * use.
 */
export function useActiveHousehold() {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['household'],
    enabled: session !== null,
    queryFn: async (): Promise<HouseholdData> => {
      const { data, error } = await supabase
        .from('household_members')
        .select('id, user_id, display_name, households(id, name)')
        .returns<HouseholdMemberRow[]>()

      if (error) throw error
      if (!data || data.length === 0 || !data[0].households) {
        throw new Error('No household found for the signed-in user.')
      }

      return {
        id: data[0].households.id,
        name: data[0].households.name,
        members: data.map((row) => ({
          id: row.id,
          userId: row.user_id,
          displayName: row.display_name,
        })),
      }
    },
  })
}

/** The viewer's IANA timezone, used for device-timezone calendar display. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
