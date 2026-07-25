import type { ComponentType, SVGProps } from 'react'
import {
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline'

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

export interface Destination {
  path: string
  label: string
  icon: IconComponent
}

/**
 * The five primary destinations shown in the phone tab bar and desktop left
 * pane. Calendar is the default; there is no Home. Notifications and Settings
 * live in the header, not here (see AppShell).
 */
export const PRIMARY_DESTINATIONS: Destination[] = [
  { path: '/calendar', label: 'Calendar', icon: CalendarDaysIcon },
  { path: '/groceries', label: 'Groceries', icon: ShoppingCartIcon },
  { path: '/ledger', label: 'Ledger', icon: BanknotesIcon },
  { path: '/notes', label: 'Notes', icon: DocumentTextIcon },
  { path: '/trips', label: 'Trips', icon: PaperAirplaneIcon },
]

export const DEFAULT_DESTINATION = '/calendar'
