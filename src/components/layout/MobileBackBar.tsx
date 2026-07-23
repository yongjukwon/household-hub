import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

// iOS-style back link shown above section pages and Settings on mobile
// (<768px), since the bottom tab bar intentionally stays at exactly the 4
// sections and has no "Home" tab of its own.
export function MobileBackBar() {
  return (
    <div className="flex items-center border-b border-[var(--line2)] px-4 py-3 md:hidden">
      <Link
        to="/"
        className="flex items-center gap-1 text-[14px] text-[var(--accent-ink)]"
      >
        <ChevronLeft size={18} />
        Household
      </Link>
    </div>
  )
}
