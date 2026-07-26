import type { ReactNode } from 'react'

import { useActiveHousehold } from '@/features/household'
import { useProfile } from '@/features/settings/profile'
import { useHouseholdRealtime } from '@/lib/operations'
import { useNotificationLifecycle } from '@/lib/notificationLifecycle'

/** Household-scoped background services mounted once after authentication. */
export function HouseholdRuntime({ children }: { children: ReactNode }) {
  const household = useActiveHousehold()
  const profile = useProfile()

  useHouseholdRealtime(household.data?.id ?? '')
  useNotificationLifecycle(profile.data?.notificationsEnabled)

  return children
}
