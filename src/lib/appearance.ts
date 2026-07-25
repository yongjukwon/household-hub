// Light/Dark/System appearance for the mobile-first shell (Task 5). "system"
// follows the OS (no attribute); an explicit choice sets data-appearance on
// <html>, which the --hh-* tokens in styles/theme.css key off.

export const appearances = ['light', 'dark', 'system'] as const
export type Appearance = (typeof appearances)[number]

const STORAGE_KEY = 'hh-appearance'

export function isAppearance(value: unknown): value is Appearance {
  return (
    typeof value === 'string' && appearances.includes(value as Appearance)
  )
}

export function getStoredAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isAppearance(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** Apply an appearance to <html> and persist it. */
export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement
  if (appearance === 'system') {
    root.removeAttribute('data-appearance')
  } else {
    root.setAttribute('data-appearance', appearance)
  }
  try {
    localStorage.setItem(STORAGE_KEY, appearance)
  } catch {
    // Storage unavailable (private mode) — the attribute still applies.
  }
}

/** Apply the persisted appearance; call once before first paint. */
export function initAppearance(): Appearance {
  const appearance = getStoredAppearance()
  applyAppearance(appearance)
  return appearance
}
