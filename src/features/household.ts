import { useHousehold, type HouseholdData } from '@/hooks/useHousehold'

/**
 * Shared accessor for the active household used by every rebuilt feature
 * screen. Wraps the existing membership query so the Task 6 flows have one
 * place to read the household id, name, and members from.
 */
export function useActiveHousehold() {
  return useHousehold()
}

export type { HouseholdData }

/** The viewer's IANA timezone, used for device-timezone calendar display. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
