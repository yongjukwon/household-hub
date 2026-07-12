import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  retryFailedWrites,
  startSyncManager,
  useOutboxStatus,
} from '@/lib/offline/syncManager'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileBackBar } from './MobileBackBar'

export function AppShell() {
  const { pathname } = useLocation()
  const showBackBar = pathname !== '/'

  // The outbox flushes while any signed-in screen is open: on mount, when
  // connectivity returns, and on a periodic fallback timer.
  useEffect(() => startSyncManager(), [])

  return (
    <div className="min-h-svh bg-[var(--canvas)] text-[var(--text)] md:flex">
      <Sidebar />
      <main className="pb-20 md:flex-1 md:pb-0">
        <SyncBanner />
        {showBackBar && <MobileBackBar />}
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

function SyncBanner() {
  const { pending, failed } = useOutboxStatus()
  if (failed > 0) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 bg-[var(--danger)]/10 px-4 py-2 text-sm text-[var(--danger)]"
      >
        <span>Some changes couldn’t sync.</span>
        <button
          type="button"
          className="font-semibold underline underline-offset-2"
          onClick={() => void retryFailedWrites()}
        >
          Retry
        </button>
      </div>
    )
  }
  if (pending > 0) {
    return (
      <p
        role="status"
        className="bg-[var(--hover)] px-4 py-2 text-sm text-[var(--meta)]"
      >
        {pending} {pending === 1 ? 'change' : 'changes'} waiting to sync…
      </p>
    )
  }
  return null
}
