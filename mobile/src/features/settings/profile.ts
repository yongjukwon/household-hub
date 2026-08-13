import { useQuery } from '@tanstack/react-query'

import type { Appearance } from '@/lib/appearance'
import {
  normalizeMobileNavigation,
  type MobileNavigation,
} from '@/components/mobileNavigation'
import { useAuth } from '@/lib/auth/AuthContext'
import {
  enqueueOperation,
  withOptimisticOverlay,
  type EnqueueOutcome,
} from '@/lib/operations'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export interface Profile {
  userId: string
  displayName: string
  appearance: Appearance
  notificationsEnabled: boolean
  mobileNavigation: MobileNavigation
  suppressUnpricedPurchaseWarning: boolean
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
        .select('user_id, display_name, appearance, notifications_enabled, mobile_navigation, suppress_unpriced_purchase_warning, revision')
        .eq('user_id', userId!)
        .maybeSingle()
        .returns<Pick<
          Tables<'profiles'>,
          'user_id' | 'display_name' | 'appearance' | 'notifications_enabled' | 'mobile_navigation' | 'suppress_unpriced_purchase_warning' | 'revision'
        > | null>()
      if (error) throw error
      if (!data) return null
      const [profile] = await withOptimisticOverlay([{
        userId: data.user_id,
        displayName: data.display_name,
        appearance: data.appearance as Appearance,
        notificationsEnabled: data.notifications_enabled,
        mobileNavigation: normalizeMobileNavigation(data.mobile_navigation),
        suppressUnpricedPurchaseWarning: data.suppress_unpriced_purchase_warning,
        revision: data.revision,
        id: data.user_id,
      }], 'settings')
      return profile
    },
  })
}

export interface ProfileSettingsPatch {
  displayName?: string
  appearance?: Appearance
  notificationsEnabled?: boolean
  mobileNavigation?: MobileNavigation
  suppressUnpricedPurchaseWarning?: boolean
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
  if (patch.mobileNavigation !== undefined)
    payload.mobileNavigation = [...patch.mobileNavigation]
  if (patch.suppressUnpricedPurchaseWarning !== undefined)
    payload.suppressUnpricedPurchaseWarning = patch.suppressUnpricedPurchaseWarning
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
