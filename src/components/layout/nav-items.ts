import {
  CircleDollarSign,
  NotebookText,
  Plane,
  ShoppingBasket,
  type LucideIcon,
} from 'lucide-react'
import type { Enums } from '@/types/database'

export type PageSection = Enums<'page_section'>
export type PageTemplate = Enums<'page_template'>

export interface NavItem {
  /** Plural route path, e.g. "/trips". */
  path: string
  label: string
  icon: LucideIcon
  /** Singular page_section enum value this route corresponds to. */
  section: PageSection
  /**
   * The section's own template choice for TemplatePicker (in addition to
   * "Blank"). Omitted for sections with no dedicated template (notes).
   */
  template?: { value: PageTemplate; label: string }
}

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/budget',
    label: 'Budget',
    icon: CircleDollarSign,
    section: 'budget',
    template: { value: 'budget', label: 'Budget' },
  },
  {
    path: '/trips',
    label: 'Trips',
    icon: Plane,
    section: 'trip',
    template: { value: 'trip', label: 'Trip' },
  },
  {
    path: '/groceries',
    label: 'Groceries',
    icon: ShoppingBasket,
    section: 'grocery',
    template: { value: 'grocery', label: 'Grocery list' },
  },
  {
    path: '/notes',
    label: 'Notes',
    icon: NotebookText,
    section: 'notes',
  },
]

/**
 * Maps a plural route path (e.g. "/trips") to its page_section enum value
 * (e.g. "trip"). Single source of truth for plural↔singular mapping — no
 * component should hand-roll this translation.
 */
export function sectionFromPath(path: string): PageSection | undefined {
  return NAV_ITEMS.find((item) => item.path === path)?.section
}

/** Reverse lookup: page_section enum value -> its NavItem. */
export function navItemForSection(section: PageSection): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.section === section)
}
