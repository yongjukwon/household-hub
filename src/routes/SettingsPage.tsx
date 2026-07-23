import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/hooks/useHousehold'

type ThemeChoice = 'light' | 'dark' | 'auto'

const THEME_KEY = 'theme'

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
]

function getInitialTheme(): ThemeChoice {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'auto'
}

function applyTheme(choice: ThemeChoice) {
  if (choice === 'auto') {
    document.documentElement.removeAttribute('data-theme')
    localStorage.removeItem(THEME_KEY)
  } else {
    document.documentElement.setAttribute('data-theme', choice)
    localStorage.setItem(THEME_KEY, choice)
  }
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { data: household, isLoading, isError } = useHousehold()
  const [theme, setTheme] = useState<ThemeChoice>(getInitialTheme)

  function handleThemeChange(choice: ThemeChoice) {
    setTheme(choice)
    applyTheme(choice)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[26px] font-bold tracking-tight text-[var(--text)]">
        Settings
      </h1>

      <section className="mt-8">
        <h2 className="text-xs font-semibold tracking-wide text-[var(--meta)]">
          ACCOUNT
        </h2>
        <p className="mt-2 text-[15px] text-[var(--text)]">{user?.email}</p>
      </section>

      <section className="mt-8 border-t border-[var(--line2)] pt-6">
        <h2 className="text-xs font-semibold tracking-wide text-[var(--meta)]">
          HOUSEHOLD
        </h2>
        {isLoading && (
          <p className="mt-2 text-sm text-[var(--meta)]">Loading…</p>
        )}
        {isError && (
          <p className="mt-2 text-sm text-[var(--danger)]">
            Could not load household.
          </p>
        )}
        {household && (
          <>
            <p className="mt-2 text-[15px] text-[var(--text)]">
              {household.name}
            </p>
            <ul className="mt-3 space-y-1">
              {household.members.map((member) => (
                <li key={member.id} className="text-sm text-[var(--meta)]">
                  {member.displayName}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-8 border-t border-[var(--line2)] pt-6">
        <h2 className="text-xs font-semibold tracking-wide text-[var(--meta)]">
          THEME
        </h2>
        <div className="mt-3 flex gap-2">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleThemeChange(option.value)}
              className={
                theme === option.value
                  ? 'rounded-sm bg-[var(--accentSoft)] px-3 py-1.5 text-sm text-[var(--accent-ink)]'
                  : 'rounded-lg px-3 py-1.5 text-sm text-[var(--meta)] hover:bg-[var(--hover)]'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8 border-t border-[var(--line2)] pt-6">
        <Button variant="destructive" onClick={() => void signOut()}>
          Sign out
        </Button>
      </section>
    </div>
  )
}
