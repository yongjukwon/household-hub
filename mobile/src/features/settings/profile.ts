import { useQuery } from '@tanstack/react-query'

import type { Appearance } from '@/lib/appearance'
import { useAuth } from '@/lib/auth/AuthContext'
import { enqueueOperation, type EnqueueOutcome } from '@/lib/operations'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export interface Profile {
  userId: string
  displayName: string
  appearance: Appearance
  notificationsEnabled: boolean
  revision: number
}

/** The signed-in user's own profile row (display name, appearance, notifications). */
export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, appearance, notifications_enabled, revision')
        .eq('user_id', userId!)
        .maybeSingle()
        .returns<Pick<
          Tables<'profiles'>,
          'user_id' | 'display_name' | 'appearance' | 'notifications_enabled' | 'revision'
        > | null>()
      if (error) throw error
      if (!data) return null
      return {
        userId: data.user_id,
        displayName: data.display_name,
        appearance: data.appearance as Appearance,
        notificationsEnabled: data.notifications_enabled,
        revision: data.revision,
      }
    },
  })
}

export interface ProfileSettingsPatch {
  displayName?: string
  appearance?: Appearance
  notificationsEnabled?: boolean
}

/**
 * Persists a profile settings change through the durable queue. `settings.update`
 * targets the actor's own profile (entityId = userId) and accepts any subset of
 * displayName / appearance / notificationsEnabled.
 */
export function saveProfileSettings(
  householdId: string,
  userId: string,
  patch: ProfileSettingsPatch,
  baseRevision: number | null,
): Promise<EnqueueOutcome> {
  const payload: Record<string, unknown> = {}
  if (patch.displayName !== undefined) payload.displayName = patch.displayName.trim()
  if (patch.appearance !== undefined) payload.appearance = patch.appearance
  if (patch.notificationsEnabled !== undefined)
    payload.notificationsEnabled = patch.notificationsEnabled
  return enqueueOperation({
    householdId,
    type: 'settings.update',
    entityType: 'settings',
    entityId: userId,
    baseRevision,
    payload,
    optimistic: payload,
  })
}
