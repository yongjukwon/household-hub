import {
  CalendarIcon,
  GroceriesIcon,
  LedgerIcon,
  NotesIcon,
  TripsIcon,
  type IconProps,
} from './icons'

export interface Destination {
  path: '/' | '/groceries' | '/ledger' | '/notes' | '/trips'
  label: string
  icon: (props: IconProps) => React.JSX.Element
}

export const TAB_DESTINATIONS: Destination[] = [
  { path: '/', label: 'Schedule', icon: CalendarIcon },
  { path: '/groceries', label: 'Groceries', icon: GroceriesIcon },
  { path: '/ledger', label: 'Ledger', icon: LedgerIcon },
  { path: '/notes', label: 'Notes', icon: NotesIcon },
  { path: '/trips', label: 'Trips', icon: TripsIcon },
]

export function tabActiveForPath(
  path: Destination['path'],
  pathname: string,
): boolean {
  return path === '/'
    ? pathname === '/'
    : pathname === path || pathname.startsWith(`${path}/`)
}
