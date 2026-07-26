import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Light/Dark/System appearance, mirroring the web client's `lib/appearance.ts`
 * exactly (same three values, same semantics: "system" follows the OS with no
 * explicit override). Persisted to AsyncStorage instead of localStorage.
 */
export const appearances = ['light', 'dark', 'system'] as const
export type Appearance = (typeof appearances)[number]

const STORAGE_KEY = 'hh-appearance'

export function isAppearance(value: unknown): value is Appearance {
  return typeof value === 'string' && (appearances as readonly string[]).includes(value)
}

export async function getStoredAppearance(): Promise<Appearance> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    return isAppearance(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export async function persistAppearance(appearance: Appearance): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, appearance)
  } catch {
    // Storage unavailable — the in-memory context value still applies for
    // this session.
  }
}
