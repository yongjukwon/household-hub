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
    && value.every((key) => CONFIGURABLE_MOBILE_DESTINATIONS.includes(key))
    && new Set(value).size === 3
}

export function normalizeMobileNavigation(value: unknown): MobileNavigation {
  return isMobileNavigation(value) ? value : DEFAULT_MOBILE_NAVIGATION
}

export function omittedDestination(
  navigation: MobileNavigation,
): MobileDestinationKey {
  return CONFIGURABLE_MOBILE_DESTINATIONS.find((key) => !navigation.includes(key))!
}

export function moveMobileDestination(
  navigation: MobileNavigation,
  index: number,
  delta: -1 | 1,
): MobileNavigation {
  const target = index + delta
  if (index < 0 || index > 2 || target < 0 || target > 2) return navigation
  const next = [...navigation]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next as unknown as MobileNavigation
}

export function replaceMobileDestination(
  navigation: MobileNavigation,
  index: number,
): MobileNavigation {
  if (index < 0 || index > 2) return navigation
  const next = [...navigation]
  next[index] = omittedDestination(navigation)
  return next as unknown as MobileNavigation
}

export function mobileTabDestinations(navigation: MobileNavigation): Array<{
  key: 'schedule' | MobileDestinationKey | 'more'
}> {
  return [
    { key: 'schedule' },
    ...navigation.map((key) => ({ key })),
    { key: 'more' as const },
  ]
}
