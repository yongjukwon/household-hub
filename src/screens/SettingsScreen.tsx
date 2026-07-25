import { useState } from 'react'
import { Screen } from '@/shell/Screen'
import { SegmentedControl } from '@/shell/ui/SegmentedControl'
import { useAuth } from '@/hooks/useAuth'
import {
  applyAppearance,
  getStoredAppearance,
  type Appearance,
} from '@/lib/appearance'

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export function SettingsScreen() {
  const { user, signOut } = useAuth()
  const [appearance, setAppearance] = useState<Appearance>(getStoredAppearance)

  function choose(next: Appearance) {
    setAppearance(next)
    applyAppearance(next)
  }

  return (
    <Screen title="Settings">
      <div className="space-y-4">
        <section className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]">
          <h2 className="mb-3 text-sm font-semibold text-[var(--hh-muted)]">
            Appearance
          </h2>
          <SegmentedControl
            label="Appearance"
            options={APPEARANCE_OPTIONS}
            value={appearance}
            onChange={choose}
          />
        </section>

        <section className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]">
          <h2 className="mb-1 text-sm font-semibold text-[var(--hh-muted)]">
            Account
          </h2>
          <p className="text-[var(--hh-ink)]">{user?.email}</p>
        </section>

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 text-left font-medium text-[var(--hh-danger)] shadow-[var(--hh-shadow-card)]"
        >
          Sign out
        </button>
      </div>
    </Screen>
  )
}
