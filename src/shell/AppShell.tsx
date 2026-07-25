import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { BellIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { setOperationQueryClient, startOperationSync } from '@/lib/operations'
import { startSyncManager } from '@/lib/offline/syncManager'
import { cn } from '@/lib/utils'
import { PRIMARY_DESTINATIONS, type IconComponent } from './destinations'

const WORDMARK = '🐰&🐧'

export function AppShell() {
  // Legacy outbox flush stays until Task 6 retires the legacy screens.
  useEffect(() => startSyncManager(), [])

  // The durable operation queue is the rebuilt clients' only write path.
  const queryClient = useQueryClient()
  useEffect(() => {
    setOperationQueryClient(queryClient)
    const stop = startOperationSync()
    return () => {
      stop()
      setOperationQueryClient(null)
    }
  }, [queryClient])

  return (
    <div className="flex min-h-svh flex-col bg-[var(--hh-canvas)] text-[var(--hh-ink)] md:flex-row">
      <DesktopNav />
      <div className="flex min-h-svh flex-1 flex-col">
        <Header />
        <main className="flex-1 pb-28 md:pb-8">
          <Outlet />
        </main>
      </div>
      <MobileTabBar />
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:px-8">
      <Link
        to="/calendar"
        aria-label="Household Hub"
        className="text-lg font-extrabold text-[var(--hh-ink)]"
      >
        {WORDMARK}
      </Link>
      <div className="flex items-center gap-2">
        <HeaderIcon to="/notifications" label="Notifications" icon={BellIcon} />
        <HeaderIcon to="/settings" label="Settings" icon={Cog6ToothIcon} />
      </div>
    </header>
  )
}

function HeaderIcon({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: IconComponent
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'grid size-10 place-items-center rounded-full bg-[var(--hh-surface)] shadow-[var(--hh-shadow-card)]',
          isActive ? 'text-[var(--hh-accent)]' : 'text-[var(--hh-ink)]',
        )
      }
    >
      <Icon className="size-5" aria-hidden />
    </NavLink>
  )
}

function DesktopNav() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-5 md:flex">
      <Link
        to="/calendar"
        className="mb-4 px-3 text-lg font-extrabold text-[var(--hh-ink)]"
      >
        {WORDMARK}
      </Link>
      {PRIMARY_DESTINATIONS.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-[var(--hh-radius-control)] px-3 py-2 text-sm font-medium',
              isActive
                ? 'bg-[var(--hh-accent-soft)] text-[var(--hh-accent)]'
                : 'text-[var(--hh-ink)] hover:bg-[var(--hh-surface-2)]',
            )
          }
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </NavLink>
      ))}
    </aside>
  )
}

function MobileTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="mx-3 flex gap-1 rounded-full border border-[var(--hh-line)] bg-[var(--hh-surface)] p-1.5 shadow-[var(--hh-shadow-float)]">
        {PRIMARY_DESTINATIONS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex min-w-14 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] font-medium',
                isActive
                  ? 'bg-[var(--hh-accent-soft)] text-[var(--hh-accent)]'
                  : 'text-[var(--hh-muted)]',
              )
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
