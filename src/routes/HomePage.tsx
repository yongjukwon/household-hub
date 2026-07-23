import { ChevronRight, PiggyBank, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NAV_ITEMS } from '@/components/layout/nav-items'

// Savings lives outside NAV_ITEMS (flat household list, like /settings).
const EXTRA_TILES = [{ path: '/savings', label: 'Savings', icon: PiggyBank }]

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <header className="mb-2 flex items-center justify-between">
        <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
          Household
        </h1>
        <Link
          to="/settings"
          aria-label="Settings"
          className="rounded-full p-2 text-[var(--meta)] hover:bg-[var(--hover)] md:hidden"
        >
          <Settings size={20} />
        </Link>
      </header>
      <div className="divide-y divide-[var(--line2)]">
        {[...NAV_ITEMS, ...EXTRA_TILES].map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="flex items-center gap-3 py-4 first:pt-0"
          >
            <Icon className="text-[var(--accent-ink)]" size={20} />
            <span className="flex-1 text-[15px] text-[var(--text)]">
              {label}
            </span>
            <span className="text-sm text-[var(--meta)]">—</span>
            <ChevronRight className="text-[var(--faint)]" size={18} />
          </Link>
        ))}
      </div>
    </div>
  )
}
