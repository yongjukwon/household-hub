import {
  CONFIGURABLE_MOBILE_DESTINATIONS,
  DEFAULT_MOBILE_NAVIGATION,
  isMobileNavigation,
  normalizeMobileNavigation,
  type MobileDestinationKey,
  type MobileNavigation,
} from '@household-hub/domain'

export {
  CONFIGURABLE_MOBILE_DESTINATIONS,
  DEFAULT_MOBILE_NAVIGATION,
  isMobileNavigation,
  normalizeMobileNavigation,
  type MobileDestinationKey,
  type MobileNavigation,
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
