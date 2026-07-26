import {
  CalendarIcon,
  CalendarIconFilled,
  GroceriesIcon,
  GroceriesIconFilled,
  LedgerIcon,
  LedgerIconFilled,
  NotesIcon,
  NotesIconFilled,
  TripsIcon,
  TripsIconFilled,
  type IconProps,
} from './icons'

export interface Destination {
  path: '/' | '/groceries' | '/ledger' | '/notes' | '/trips'
  label: string
  icon: (props: IconProps) => React.JSX.Element
  activeIcon: (props: IconProps) => React.JSX.Element
}

export const TAB_DESTINATIONS: Destination[] = [
  { path: '/', label: 'Schedule', icon: CalendarIcon, activeIcon: CalendarIconFilled },
  { path: '/groceries', label: 'Groceries', icon: GroceriesIcon, activeIcon: GroceriesIconFilled },
  { path: '/ledger', label: 'Ledger', icon: LedgerIcon, activeIcon: LedgerIconFilled },
  { path: '/notes', label: 'Notes', icon: NotesIcon, activeIcon: NotesIconFilled },
  { path: '/trips', label: 'Trips', icon: TripsIcon, activeIcon: TripsIconFilled },
]

export function tabActiveForPath(
  path: Destination['path'],
  pathname: string,
): boolean {
  return path === '/'
    ? pathname === '/'
    : pathname === path || pathname.startsWith(`${path}/`)
}
