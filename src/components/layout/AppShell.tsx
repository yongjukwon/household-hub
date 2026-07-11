import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileBackBar } from './MobileBackBar'

export function AppShell() {
  const { pathname } = useLocation()
  const showBackBar = pathname !== '/'

  return (
    <div className="min-h-svh bg-[var(--canvas)] text-[var(--text)] md:flex">
      <Sidebar />
      <main className="pb-20 md:flex-1 md:pb-0">
        {showBackBar && <MobileBackBar />}
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
