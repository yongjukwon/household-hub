import { TAB_DESTINATIONS, tabActiveForPath } from './tabDestinations'

export type HeaderBackDestination = {
  path: '/groceries' | '/ledger' | '/notes' | '/trips'
  label: string
}

export function titleForPath(pathname: string): string {
  if (/^\/ledger\/[^/]+$/.test(pathname)) return 'Budget'
  const match = TAB_DESTINATIONS.find((destination) =>
    tabActiveForPath(destination.path, pathname),
  )
  return match?.label ?? 'Household Hub'
}

export function backDestinationForPath(
  pathname: string,
): HeaderBackDestination | null {
  if (/^\/groceries\/[^/]+$/.test(pathname)) {
    return { path: '/groceries', label: 'Back to Groceries' }
  }
  if (/^\/ledger\/[^/]+$/.test(pathname)) {
    return { path: '/ledger', label: 'Back to Ledger' }
  }
  if (/^\/notes\/[^/]+$/.test(pathname)) {
    return { path: '/notes', label: 'Back to Notes' }
  }
  if (/^\/trips\/[^/]+$/.test(pathname)) {
    return { path: '/trips', label: 'Back to Trips' }
  }
  return null
}
