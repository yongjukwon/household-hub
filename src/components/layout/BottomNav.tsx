import { NavLink } from 'react-router-dom'
import { CalendarDays, PiggyBank } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './nav-items'

// Calendar and Savings live outside NAV_ITEMS (no page_section of their own —
// flat household lists, like /settings), so they're appended manually here.
const EXTRA_TABS = [
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/savings', label: 'Savings', icon: PiggyBank },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t border-[var(--line2)] bg-[var(--panel)] pb-[env(safe-area-inset-bottom)] md:hidden">
      {[...NAV_ITEMS, ...EXTRA_TABS].map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 border-t-2 py-2.5 text-[11px]',
              isActive
                ? 'border-[var(--accent)] font-semibold text-[var(--accent-ink)]'
                : 'border-transparent text-[var(--meta)]',
            )
          }
        >
          <Icon size={22} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
