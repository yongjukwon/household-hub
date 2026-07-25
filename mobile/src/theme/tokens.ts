import { useColorScheme } from 'react-native'

/**
 * Semantic design tokens mirroring the web app's `--hh-*` variables. The full
 * visual system lands with the native feature screens (Task 8); this is the
 * shared palette the foundation needs so the shell honours system appearance.
 */
export interface ThemeTokens {
  canvas: string
  card: string
  ink: string
  mutedInk: string
  accent: string
  accentInk: string
  border: string
  tabInactive: string
}

export const lightTokens: ThemeTokens = {
  canvas: '#EFEFF2',
  card: '#FFFFFF',
  ink: '#14151A',
  mutedInk: '#6B6F76',
  accent: '#FF7A45',
  accentInk: '#FFFFFF',
  border: '#E4E4EA',
  tabInactive: '#9A9EA6',
}

export const darkTokens: ThemeTokens = {
  canvas: '#121316',
  card: '#1E1F24',
  ink: '#F4F4F7',
  mutedInk: '#9A9EA6',
  accent: '#FF7A45',
  accentInk: '#14151A',
  border: '#2C2D33',
  tabInactive: '#6B6F76',
}

/** Resolves tokens from the OS light/dark setting (`userInterfaceStyle`). */
export function useTheme(): { tokens: ThemeTokens; scheme: 'light' | 'dark' } {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  return { tokens: scheme === 'dark' ? darkTokens : lightTokens, scheme }
}
