import { Link, NavLink } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './nav-items'

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r md:border-[var(--line2)] md:bg-[var(--sidebar)]">
      <div className="px-5 pt-6 pb-4">
        <Link
          to="/"
          className="text-xs font-semibold tracking-wide text-[var(--meta)]"
        >
          HOUSEHOLD
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm',
                isActive
                  ? 'bg-[var(--accentSoft)] text-[var(--accent)]'
                  : 'text-[var(--text)] hover:bg-[var(--hover)]',
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-2 pb-6">
        <Link
          to="/settings"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--meta)] hover:bg-[var(--hover)]"
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>
    </aside>
  )
}
