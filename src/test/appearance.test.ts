import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyAppearance,
  getStoredAppearance,
  initAppearance,
  isAppearance,
} from '@/lib/appearance'

// This Node/jsdom setup doesn't provide localStorage, so stub an in-memory one.
const store = new Map<string, string>()

describe('appearance', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    })
    document.documentElement.removeAttribute('data-appearance')
  })

  it('recognizes only the three appearances', () => {
    expect(isAppearance('light')).toBe(true)
    expect(isAppearance('dark')).toBe(true)
    expect(isAppearance('system')).toBe(true)
    expect(isAppearance('auto')).toBe(false)
    expect(isAppearance(null)).toBe(false)
  })

  it('defaults to system when nothing is stored', () => {
    expect(getStoredAppearance()).toBe('system')
  })

  it('sets data-appearance for an explicit choice and clears it for system', () => {
    applyAppearance('dark')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dark')
    expect(getStoredAppearance()).toBe('dark')

    applyAppearance('system')
    expect(document.documentElement.hasAttribute('data-appearance')).toBe(false)
    expect(getStoredAppearance()).toBe('system')
  })

  it('re-applies the persisted appearance on init', () => {
    applyAppearance('light')
    document.documentElement.removeAttribute('data-appearance')
    expect(initAppearance()).toBe('light')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('light')
  })
})
