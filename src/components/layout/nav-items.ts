import {
  CircleDollarSign,
  NotebookText,
  Plane,
  ShoppingBasket,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/budget', label: 'Budget', icon: CircleDollarSign },
  { path: '/trips', label: 'Trips', icon: Plane },
  { path: '/groceries', label: 'Groceries', icon: ShoppingBasket },
  { path: '/notes', label: 'Notes', icon: NotebookText },
]
