import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

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

interface HouseholdMemberRow {
  id: string
  user_id: string
  display_name: string
  households: { id: string; name: string } | null
}

// Assumes one household per user: reads members via the signed-in user's
// own membership rows and takes the household from the first one (data[0]).
// If a user ever belongs to more than one household, this only surfaces one.
export function useHousehold() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['household'],
    enabled: !!user,
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
