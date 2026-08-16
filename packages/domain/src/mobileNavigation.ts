export const CONFIGURABLE_MOBILE_DESTINATIONS = [
  'groceries',
  'ledger',
  'notes',
  'trips',
] as const

export type MobileDestinationKey =
  (typeof CONFIGURABLE_MOBILE_DESTINATIONS)[number]

export type MobileNavigation = readonly [
  MobileDestinationKey,
  MobileDestinationKey,
  MobileDestinationKey,
]

export const DEFAULT_MOBILE_NAVIGATION: MobileNavigation = [
  'groceries',
  'ledger',
  'trips',
]

export function isMobileNavigation(value: unknown): value is MobileNavigation {
  return Array.isArray(value)
    && value.length === 3
    && value.every((key): key is MobileDestinationKey =>
      typeof key === 'string'
      && CONFIGURABLE_MOBILE_DESTINATIONS.includes(key as MobileDestinationKey))
    && new Set(value).size === 3
}

export function normalizeMobileNavigation(value: unknown): MobileNavigation {
  return isMobileNavigation(value) ? value : DEFAULT_MOBILE_NAVIGATION
}
