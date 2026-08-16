import { useColorScheme } from 'react-native'

import { useAppearance } from './AppearanceProvider'

/**
 * Semantic design tokens, ported from the web app's `--hh-*` CSS variables
 * (`src/styles/theme.css`) and the mobile design reference
 * (`docs/mobile-design-reference/README.md`) so native matches web pixel-for-
 * pixel rather than reinterpreting the palette.
 */
export interface ThemeTokens {
  canvas: string
  card: string
  cardAlt: string
  /** Raised interactive controls (8dp in the dark elevation hierarchy). */
  control: string
  /** Dialogs, menus, and bottom sheets (12dp in the dark elevation hierarchy). */
  modal: string
  ink: string
  /** `rgba(...,0.5)` muted text. */
  muted: string
  /** `rgba(...,0.45)` slightly lighter muted text (meta lines, timestamps). */
  muted2: string
  /** `rgba(...,0.4)` lightest muted text. */
  muted3: string
  /** Hairline border/divider color. */
  line: string
  accent: string
  accentContrast: string
  /** Soft accent tint, e.g. today's calendar-cell background. */
  accentSoft: string
  accentSecondary: string
  /** Two-stop sage gradient for the FAB. */
  accentGradient: [string, string]
  danger: string
  radiusCard: number
  radiusControl: number
  shadowCard: ShadowStyle
  shadowFloat: ShadowStyle
  data: {
    blue: string
    blueBg: string
    purple: string
    purpleBg: string
    amber: string
    amberBg: string
    green: string
    greenBg: string
    teal: string
    tealBg: string
    pink: string
    pinkBg: string
  }
  /** Frosted-glass surface (Card, header icon buttons, floating tab bar). */
  glass: {
    fill: string
    border: string
  }
  /** Flatter, more opaque surface for list rows (events, checklist, categories). */
  row: {
    fill: string
    border: string
  }
  /** Diagonal screen-background gradient stops. */
  gradientColors: [string, string, string]
  /** Decorative radial glow colors layered behind the gradient. */
  glow: {
    primary: string
    secondary: string
  }
}

interface ShadowStyle {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

function shadow(opacity: number, radius: number, elevation: number): ShadowStyle {
  return {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: radius / 3 },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  }
}

export const lightTokens: ThemeTokens = {
  canvas: '#FFFFFF',
  card: '#F6F7F9',
  cardAlt: '#EFF0F2',
  control: '#EFF0F2',
  modal: '#F6F7F9',
  ink: '#14151A',
  muted: 'rgba(20, 21, 26, 0.5)',
  muted2: 'rgba(20, 21, 26, 0.45)',
  muted3: 'rgba(20, 21, 26, 0.4)',
  line: 'rgba(20, 21, 26, 0.08)',
  accent: '#6F9483',
  accentContrast: '#FFFFFF',
  accentSoft: 'rgba(111, 148, 131, 0.14)',
  accentSecondary: '#8FA89F',
  accentGradient: ['#6F9483', '#8FA89F'],
  danger: '#D6465F',
  radiusCard: 20,
  radiusControl: 14,
  shadowCard: shadow(0.06, 12, 3),
  shadowFloat: shadow(0.12, 16, 6),
  data: {
    blue: '#5A73E8',
    blueBg: '#E8ECFF',
    purple: '#8A63E8',
    purpleBg: '#EFE9FF',
    amber: '#D69412',
    amberBg: '#FDF1DA',
    green: '#379962',
    greenBg: '#E4F5EC',
    teal: '#279A8B',
    tealBg: '#E1F5F2',
    pink: '#D6465F',
    pinkBg: '#FCE7EA',
  },
  glass: {
    fill: 'rgba(255, 255, 255, 0.65)',
    border: 'rgba(255, 255, 255, 0.75)',
  },
  row: {
    fill: 'rgba(255, 255, 255, 0.7)',
    border: 'rgba(255, 255, 255, 0.8)',
  },
  gradientColors: ['#eef2ef', '#f7f2ea', '#eef1f5'],
  glow: {
    primary: 'rgba(143, 168, 159, 0.22)',
    secondary: 'rgba(255, 157, 102, 0.15)',
  },
}

export const darkTokens: ThemeTokens = {
  canvas: '#121212',
  card: '#1E1E1E',
  cardAlt: '#222222',
  control: '#2E2E2E',
  modal: '#333333',
  ink: '#F4F5F8',
  muted: 'rgba(244, 245, 248, 0.55)',
  muted2: 'rgba(244, 245, 248, 0.48)',
  muted3: 'rgba(244, 245, 248, 0.4)',
  line: 'rgba(255, 255, 255, 0.09)',
  accent: '#6F9483',
  accentContrast: '#14151A',
  accentSoft: 'rgba(111, 148, 131, 0.22)',
  accentSecondary: '#8FA89F',
  accentGradient: ['#6F9483', '#8FA89F'],
  danger: '#EF6F83',
  radiusCard: 20,
  radiusControl: 14,
  shadowCard: shadow(0.4, 12, 3),
  shadowFloat: shadow(0.5, 16, 6),
  data: {
    blue: '#5A73E8',
    blueBg: 'rgba(90, 115, 232, 0.2)',
    purple: '#8A63E8',
    purpleBg: 'rgba(138, 99, 232, 0.2)',
    amber: '#D69412',
    amberBg: 'rgba(214, 148, 18, 0.2)',
    green: '#379962',
    greenBg: 'rgba(55, 153, 98, 0.2)',
    teal: '#279A8B',
    tealBg: 'rgba(39, 154, 139, 0.2)',
    pink: '#D6465F',
    pinkBg: 'rgba(214, 70, 95, 0.2)',
  },
  glass: {
    fill: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.12)',
  },
  row: {
    fill: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.1)',
  },
  gradientColors: ['#14171a', '#1a1815', '#14161a'],
  glow: {
    primary: 'rgba(143, 168, 159, 0.14)',
    secondary: 'rgba(255, 157, 102, 0.1)',
  },
}

/** Resolves tokens from the OS light/dark setting (`userInterfaceStyle`). */
export function useTheme(): { tokens: ThemeTokens; scheme: 'light' | 'dark' } {
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const { appearance } = useAppearance()
  const scheme = appearance === 'system' ? systemScheme : appearance
  return { tokens: scheme === 'dark' ? darkTokens : lightTokens, scheme }
}
