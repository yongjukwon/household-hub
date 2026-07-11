import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="min-h-svh bg-[var(--canvas)] text-[var(--text)] md:flex">
      <Sidebar />
      <main className="pb-20 md:flex-1 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
