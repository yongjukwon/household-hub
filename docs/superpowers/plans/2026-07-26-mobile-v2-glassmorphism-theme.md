# Mobile v2 Glassmorphism Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the native mobile app to the v2 Claude Design reference — gradient background with glassmorphism surfaces, sage primary accent, and a floating tab bar with real outline→filled tab icons — without changing any component location, navigation structure, or feature behavior.

**Architecture:** Everything routes through the existing token layer (`theme/tokens.ts`), so most screens need zero changes. Three genuinely new pieces of native surface (glass `Card`, glass header icon buttons, floating glass tab bar) are added; a single reusable `GradientBackground` component is mounted behind the app's 4 independently-navigated native screens; ~20 screens flip their own opaque background to transparent so the shared gradient shows through. Web gets a one-line accent update to preserve the native/web accent parity established by `2026-07-26-white-canvas-tonal-surfaces-design.md`.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router (file-based, `Slot`-driven custom tab layout), `expo-blur` (new), `expo-linear-gradient` (new), `react-native-svg` (already present, used for the two decorative glow blobs via `RadialGradient`).

## Global Constraints

- Do not change any component's location, navigation structure, screen composition, or feature behavior — this is a visual-only reskin (from `docs/superpowers/specs/2026-07-26-mobile-v2-glassmorphism-theme-design.md`).
- Do not change the 6-color ledger/statement category palette (`tokens.data`, `StatementCharts.tsx`'s `COLORS` array) — that's data/category color-coding, not theme.
- Do not change typography, spacing, or corner radii — only background, glass surface treatment, and accent colors.
- New native deps (`expo-blur`, `expo-linear-gradient`) require `expo prebuild` + rebuilding the dev client before they're visible in the simulator.
- Web (`src/styles/theme.css`) only gets its `--hh-accent`/`--hh-accent-soft` values updated for parity — no other web change.
- All new/changed color values are exact hex/rgba from the spec — do not eyeball substitutes.

---

### Task 1: Install native deps, wire app.json, rebuild the dev client

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`

**Interfaces:**
- Produces: `expo-blur`'s `BlurView`, `expo-linear-gradient`'s `LinearGradient`, available to import in later tasks.

- [ ] **Step 1: Install the two new packages via the Expo-aware installer**

Run (from `mobile/`):
```bash
npx expo install expo-blur expo-linear-gradient
```
Expected: `package.json` gains `expo-blur` and `expo-linear-gradient` at the SDK 57–compatible versions `expo install` resolves; `package-lock.json` updates accordingly.

- [ ] **Step 2: Update the notification icon tint to the new sage primary**

In `mobile/app.json`, inside `expo.plugins`, find:
```json
      [
        "expo-notifications",
        {
          "color": "#FF7A45"
        }
      ],
```
Replace with:
```json
      [
        "expo-notifications",
        {
          "color": "#6F9483"
        }
      ],
```

- [ ] **Step 3: Regenerate native projects and rebuild the dev client**

Run (from `mobile/`):
```bash
npx expo prebuild --clean
npx expo run:ios
```
Expected: build succeeds and the existing app launches unchanged in the simulator (no visual difference yet — the new deps are linked but unused). This is the only rebuild needed for this whole plan; every later task is a JS-only change and reloads instantly.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore(mobile): add expo-blur/expo-linear-gradient, retint notification icon"
```

---

### Task 2: Extend theme tokens with the v2 palette

**Files:**
- Modify: `mobile/src/theme/tokens.ts`
- Modify: `mobile/src/theme/tokens.test.ts`

**Interfaces:**
- Produces: `ThemeTokens.accentSecondary: string`, `ThemeTokens.accentGradient: [string, string]`, `ThemeTokens.glass: { fill: string; border: string }`, `ThemeTokens.row: { fill: string; border: string }`, `ThemeTokens.gradientColors: [string, string, string]`, `ThemeTokens.glow: { primary: string; secondary: string }` — consumed by Tasks 3–8.
- `accent` changes from `#FF7A45` to `#6F9483` in both `lightTokens` and `darkTokens`; `accentSoft` is recomputed at the same alpha on the new hue.

- [ ] **Step 1: Write the failing token-contract assertions**

Replace the full contents of `mobile/src/theme/tokens.test.ts` with:

```ts
import { darkTokens, lightTokens } from './tokens'

describe('theme surface hierarchy', () => {
  it('uses the approved light-mode tonal surfaces', () => {
    expect(lightTokens).toMatchObject({
      canvas: '#FFFFFF',
      card: '#F6F7F9',
      cardAlt: '#EFF0F2',
      ink: '#14151A',
      line: 'rgba(20, 21, 26, 0.08)',
      accent: '#6F9483',
      accentSecondary: '#8FA89F',
    })

    expect(
      new Set([lightTokens.canvas, lightTokens.card, lightTokens.cardAlt]).size,
    ).toBe(3)
  })

  it('uses the approved dark-mode tonal surfaces', () => {
    expect(darkTokens).toMatchObject({
      canvas: '#0F1014',
      card: '#191B22',
      cardAlt: '#242731',
      ink: '#F4F5F8',
      line: 'rgba(255, 255, 255, 0.09)',
      accent: '#6F9483',
      accentSecondary: '#8FA89F',
    })

    expect(
      new Set([darkTokens.canvas, darkTokens.card, darkTokens.cardAlt]).size,
    ).toBe(3)
  })
})

describe('v2 glassmorphism tokens', () => {
  it('defines distinct glass and row surface treatments per mode', () => {
    expect(lightTokens.glass).toEqual({
      fill: 'rgba(255, 255, 255, 0.65)',
      border: 'rgba(255, 255, 255, 0.75)',
    })
    expect(lightTokens.row).toEqual({
      fill: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.8)',
    })
    expect(darkTokens.glass).toEqual({
      fill: 'rgba(255, 255, 255, 0.08)',
      border: 'rgba(255, 255, 255, 0.12)',
    })
    expect(darkTokens.row).toEqual({
      fill: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(255, 255, 255, 0.1)',
    })
  })

  it('defines the diagonal gradient and glow colors for both modes', () => {
    expect(lightTokens.gradientColors).toEqual(['#eef2ef', '#f7f2ea', '#eef1f5'])
    expect(lightTokens.glow).toEqual({
      primary: 'rgba(143, 168, 159, 0.22)',
      secondary: 'rgba(255, 157, 102, 0.15)',
    })
    expect(darkTokens.glow).toEqual({
      primary: 'rgba(143, 168, 159, 0.14)',
      secondary: 'rgba(255, 157, 102, 0.1)',
    })
  })

  it('defines a sage FAB gradient in both modes', () => {
    expect(lightTokens.accentGradient).toEqual(['#6F9483', '#8FA89F'])
    expect(darkTokens.accentGradient).toEqual(['#6F9483', '#8FA89F'])
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm test -- tokens.test.ts`
Expected: FAIL — `accent` still `#FF7A45`, `accentSecondary`/`glass`/`row`/`gradientColors`/`glow`/`accentGradient` undefined.

- [ ] **Step 3: Implement the new tokens**

In `mobile/src/theme/tokens.ts`, update the `ThemeTokens` interface (after the existing `accentSoft: string` line) to add:

```ts
  accentSecondary: string
  /** Two-stop sage gradient for the FAB. */
  accentGradient: [string, string]
```

and after the `data: {...}` block's closing, add three more fields to the interface:

```ts
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
```

Update `lightTokens`: change `accent: '#FF7A45'` to `accent: '#6F9483'`, change `accentSoft: 'rgba(255, 122, 69, 0.14)'` to `accentSoft: 'rgba(111, 148, 131, 0.14)'`, and add after `accentSoft`:

```ts
  accentSecondary: '#8FA89F',
  accentGradient: ['#6F9483', '#8FA89F'],
```

Add after the `data: {...}` block in `lightTokens` (before the closing `}`):

```ts
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
```

Update `darkTokens` the same way: `accent: '#6F9483'`, `accentSoft: 'rgba(111, 148, 131, 0.22)'`, add `accentSecondary: '#8FA89F'`, `accentGradient: ['#6F9483', '#8FA89F']` after `accentSoft`, and add after `data: {...}`:

```ts
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
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npm test -- tokens.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/theme/tokens.ts src/theme/tokens.test.ts
git commit -m "feat(mobile): add v2 glassmorphism palette to theme tokens"
```

---

### Task 3: Add filled tab-icon variants

**Files:**
- Modify: `mobile/src/components/icons.tsx`
- Modify: `mobile/src/components/tabDestinations.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CalendarIconFilled`, `GroceriesIconFilled`, `LedgerIconFilled`, `NotesIconFilled`, `TripsIconFilled` (same `IconProps` shape as the outline icons, but `fill`-based, no `stroke`). `Destination.activeIcon: (props: IconProps) => React.JSX.Element` — consumed by Task 6 (`FloatingTabBar`).

- [ ] **Step 1: Add a `filled()` helper and the 5 filled icons**

In `mobile/src/components/icons.tsx`, after the existing `outline()` helper function, add:

```ts
function filled(paths: string[]) {
  return function HeroIconFilled({ size = 20, color = 'currentColor' }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        {paths.map((d) => (
          <Path key={d} d={d} />
        ))}
      </Svg>
    )
  }
}
```

After the existing `TripsIcon` outline export, add the 5 filled variants (path data taken verbatim from `docs/mobile-design-reference/v2/Household Hub v2.dc.html`'s `.icon-filled` SVGs):

```ts
export const CalendarIconFilled = filled([
  'M3 5a2 2 0 012-2h1v3a1 1 0 002 0V3h8v3a1 1 0 002 0V3h1a2 2 0 012 2v3H3zM3 10h18v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
])

export const GroceriesIconFilled = filled([
  'M2 3h2.2l.4 2H21a1 1 0 01.97 1.24l-1.8 7.2A2 2 0 0118.24 15H8.2a2 2 0 01-1.96-1.6L4.2 5H2zM8 21a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm10 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
])

export const LedgerIconFilled = filled([
  'M6 3h11a1 1 0 011 1v16a1 1 0 01-1 1H6a3 3 0 01-3-3V6a3 3 0 013-3zm1 5h4v2H7zm0 4h4v2H7z',
])

export const NotesIconFilled = filled([
  'M4 3h16a1 1 0 011 1v14a1 1 0 01-1 1h-.2L16 21.8V19H4a1 1 0 01-1-1V4a1 1 0 011-1zm3.5 5a.8.8 0 000 1.6h9a.8.8 0 000-1.6zm0 4a.8.8 0 000 1.6h6a.8.8 0 000-1.6z',
])

export const TripsIconFilled = filled([
  'M2.5 19.5l19-7c1-.4 1-1.6 0-2l-19-7v6.5l11 1.5-11 1.5z',
])
```

- [ ] **Step 2: Wire the filled icons into `TAB_DESTINATIONS`**

In `mobile/src/components/tabDestinations.ts`, update the import to also bring in the filled variants:

```ts
import {
  CalendarIcon,
  CalendarIconFilled,
  GroceriesIcon,
  GroceriesIconFilled,
  LedgerIcon,
  LedgerIconFilled,
  NotesIcon,
  NotesIconFilled,
  TripsIcon,
  TripsIconFilled,
  type IconProps,
} from './icons'
```

Add `activeIcon` to the `Destination` interface:

```ts
export interface Destination {
  path: '/' | '/groceries' | '/ledger' | '/notes' | '/trips'
  label: string
  icon: (props: IconProps) => React.JSX.Element
  activeIcon: (props: IconProps) => React.JSX.Element
}
```

Update `TAB_DESTINATIONS`:

```ts
export const TAB_DESTINATIONS: Destination[] = [
  { path: '/', label: 'Schedule', icon: CalendarIcon, activeIcon: CalendarIconFilled },
  { path: '/groceries', label: 'Groceries', icon: GroceriesIcon, activeIcon: GroceriesIconFilled },
  { path: '/ledger', label: 'Ledger', icon: LedgerIcon, activeIcon: LedgerIconFilled },
  { path: '/notes', label: 'Notes', icon: NotesIcon, activeIcon: NotesIconFilled },
  { path: '/trips', label: 'Trips', icon: TripsIcon, activeIcon: TripsIconFilled },
]
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (Task 6 is what actually consumes `activeIcon`; this task just needs to compile cleanly on its own).

- [ ] **Step 4: Commit**

```bash
git add src/components/icons.tsx src/components/tabDestinations.ts
git commit -m "feat(mobile): add filled tab icon variants for the active-tab state"
```

---

### Task 4: `Card` glass/row variants

**Files:**
- Modify: `mobile/src/components/Card.tsx`
- Modify: `mobile/src/components/ListCard.tsx`
- Test: `mobile/src/components/ListCard.test.tsx` (existing — must keep passing unmodified)

**Interfaces:**
- Consumes: `tokens.glass`, `tokens.row` (Task 2).
- Produces: `Card`'s new `variant?: 'glass' | 'row'` prop (default `'glass'`) — consumed by Task 5 (`ListCard` passes `'row'`; every other existing `<Card>` caller is unaffected and keeps the default).

- [ ] **Step 1: Write a failing test for the new variant**

Create `mobile/src/components/Card.test.tsx`:

```tsx
import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { lightTokens } from '@/theme/tokens'
import { Card } from './Card'

describe('Card', () => {
  it('defaults to the glass variant using BlurView', async () => {
    const view = await render(<Card>{null}</Card>)
    const root = view.toJSON()

    expect(root).not.toBeNull()
    expect(!Array.isArray(root) && root ? root.type : undefined).toBe('BlurView')
    expect(
      StyleSheet.flatten(
        !Array.isArray(root) && root ? root.props.style : undefined,
      ),
    ).toMatchObject({
      backgroundColor: lightTokens.glass.fill,
      borderColor: lightTokens.glass.border,
    })
  })

  it('renders a flat translucent surface for the row variant', async () => {
    const view = await render(<Card variant="row">{null}</Card>)
    const root = view.toJSON()

    expect(root).not.toBeNull()
    expect(!Array.isArray(root) && root ? root.type : undefined).toBe('View')
    expect(
      StyleSheet.flatten(
        !Array.isArray(root) && root ? root.props.style : undefined,
      ),
    ).toMatchObject({
      backgroundColor: lightTokens.row.fill,
      borderColor: lightTokens.row.border,
    })
  })
})
```

- [ ] **Step 2: Add a jest mock for `expo-blur` so BlurView renders as a plain node in tests**

In `mobile/jest.setup.ts`, after the existing `@react-native-community/netinfo` mock, add:

```ts
// expo-blur ships a native view; tests just need something renderable.
jest.mock('expo-blur', () => {
  const { View } = require('react-native')
  return { BlurView: View }
})
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npm test -- Card.test.tsx`
Expected: FAIL — `Card` has no `variant` prop yet and still renders a plain `View` with the old solid `tokens.card` color.

- [ ] **Step 4: Implement the variant**

Replace the full contents of `mobile/src/components/Card.tsx` with:

```tsx
import type { ReactNode } from 'react'
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { BlurView } from 'expo-blur'

import { useTheme } from '@/theme/tokens'

interface CardProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  /**
   * `glass` (default): frosted, blurred surface for hero/section cards.
   * `row`: flatter, more opaque, unblurred surface for list rows.
   */
  variant?: 'glass' | 'row'
}

/** Surface card: glass or flat-row treatment, per the v2 design reference. */
export function Card({ children, style, variant = 'glass' }: CardProps) {
  const { tokens, scheme } = useTheme()

  if (variant === 'row') {
    return (
      <View
        style={[
          styles.surface,
          {
            backgroundColor: tokens.row.fill,
            borderColor: tokens.row.border,
            borderRadius: tokens.radiusCard,
          },
          style,
        ]}
      >
        {children}
      </View>
    )
  }

  return (
    <BlurView
      intensity={40}
      tint={scheme}
      style={[
        styles.surface,
        {
          backgroundColor: tokens.glass.fill,
          borderColor: tokens.glass.border,
          borderRadius: tokens.radiusCard,
        },
        tokens.shadowCard,
        style,
      ]}
    >
      {children}
    </BlurView>
  )
}

const styles = StyleSheet.create({
  surface: { padding: 16, borderWidth: 1 },
})
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test -- Card.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 6: Point `ListCard` at the row variant**

Replace the full contents of `mobile/src/components/ListCard.tsx` with:

```tsx
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { useTheme } from '@/theme/tokens'
import { Card } from './Card'

interface ListCardProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/** Tappable collection-row surface matching the Ledger segmented track. */
export function ListCard({ children, style }: ListCardProps) {
  const { tokens } = useTheme()
  const radiusStyle = { borderRadius: tokens.radiusControl }

  return (
    <Card variant="row" style={style ? [radiusStyle, style] : radiusStyle}>
      {children}
    </Card>
  )
}
```

- [ ] **Step 7: Run the full existing `ListCard` test to confirm it still passes unmodified**

Run: `npm test -- ListCard.test.tsx`
Expected: PASS — the existing assertion on `borderRadius === lightTokens.radiusControl` still holds since `Card`'s row variant applies `style` last, same as before.

- [ ] **Step 8: Commit**

```bash
git add src/components/Card.tsx src/components/Card.test.tsx src/components/ListCard.tsx jest.setup.ts
git commit -m "feat(mobile): add Card glass/row variants backed by BlurView"
```

---

### Task 5: Glass header icon buttons

**Files:**
- Modify: `mobile/src/components/AppHeader.tsx`
- Test: `mobile/src/components/AppHeader.test.tsx` (existing — must keep passing unmodified)

**Interfaces:**
- Consumes: `tokens.glass` (Task 2), the `expo-blur` jest mock (Task 4).

- [ ] **Step 1: Confirm the existing AppHeader test still targets stable behavior**

Run: `npm test -- AppHeader.test.tsx`
Expected: PASS (baseline, before this task's change — none of its assertions touch color/background, only layout/position and navigation behavior, so it's safe to change the button's visual implementation underneath).

- [ ] **Step 2: Swap the icon buttons to glass**

In `mobile/src/components/AppHeader.tsx`, add the import:

```ts
import { BlurView } from 'expo-blur'
```

Replace the header row's `backgroundColor: tokens.canvas` with `backgroundColor: 'transparent'` (this screen-transparency change is formalized across every screen in Task 7 — doing it here too keeps the header consistent with its own task instead of leaving a stray solid fill):

```tsx
      style={[
        styles.row,
        { paddingTop: insets.top + 6, backgroundColor: 'transparent' },
      ]}
```

Replace each of the three `Pressable` icon buttons' `style` array — currently `[styles.iconButton, { backgroundColor: tokens.card }, tokens.shadowCard]` — by wrapping the icon in a `BlurView` instead. For example, the back button becomes:

```tsx
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backDestination.label}
          hitSlop={4}
          onPress={() => router.replace(backDestination.path)}
        >
          <BlurView
            intensity={30}
            tint={scheme}
            style={[
              styles.iconButton,
              {
                backgroundColor: tokens.glass.fill,
                borderColor: tokens.glass.border,
                borderWidth: 1,
              },
            ]}
          >
            <ChevronLeftIcon size={18} color={tokens.muted} />
          </BlurView>
        </Pressable>
```

Apply the same wrapping to the Notifications and Settings buttons (same `BlurView` props, `BellIcon`/`CogIcon` children unchanged). Add `const { tokens, scheme } = useTheme()` at the top of the component (destructure `scheme` alongside the existing `tokens`).

- [ ] **Step 3: Run the existing test to confirm nothing broke**

Run: `npm test -- AppHeader.test.tsx`
Expected: PASS — none of its assertions inspect color or the `Pressable`/`BlurView` nesting, only `testID`, position styles, and `onPress` behavior via `accessibilityLabel`, all unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppHeader.tsx
git commit -m "feat(mobile): glass surface for header icon buttons"
```

---

### Task 6: Floating glass tab bar with filled-icon swap

**Files:**
- Modify: `mobile/src/components/FloatingTabBar.tsx`

**Interfaces:**
- Consumes: `tokens.glass` (Task 2), `Destination.activeIcon` (Task 3), the `expo-blur` jest mock (Task 4).
- Produces: `TAB_BAR_FLOAT_OFFSET = 20`, `TAB_BAR_HEIGHT = 66` (exported constants) — consumed by Task 7 (`(tabs)/_layout.tsx` content padding) and Task 8 (`FloatingActionButton`'s bottom offset).

- [ ] **Step 1: Write a failing test for the floating glass behavior**

Create `mobile/src/components/FloatingTabBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { FloatingTabBar, TAB_BAR_FLOAT_OFFSET, TAB_BAR_HEIGHT } from './FloatingTabBar'

const mockedReplace = jest.fn()

jest.mock('expo-router', () => ({
  usePathname: () => '/ledger',
  useRouter: () => ({ replace: mockedReplace }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

describe('FloatingTabBar', () => {
  beforeEach(() => {
    mockedReplace.mockReset()
  })

  it('floats above the bottom edge as a glass pill, not docked flush', async () => {
    const view = await render(<FloatingTabBar />)
    const root = view.toJSON()

    expect(root).not.toBeNull()
    expect(!Array.isArray(root) && root ? root.type : undefined).toBe('BlurView')
    expect(
      StyleSheet.flatten(!Array.isArray(root) && root ? root.props.style : undefined),
    ).toMatchObject({
      position: 'absolute',
      bottom: TAB_BAR_FLOAT_OFFSET,
      height: TAB_BAR_HEIGHT,
    })
  })

  it('marks the active destination selected and navigates on press', async () => {
    await render(<FloatingTabBar />)

    expect(screen.getByLabelText('Ledger').props.accessibilityState).toEqual({
      selected: true,
    })
    expect(screen.getByLabelText('Schedule').props.accessibilityState).toEqual({
      selected: false,
    })

    await fireEvent.press(screen.getByLabelText('Schedule'))
    expect(mockedReplace).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- FloatingTabBar.test.tsx`
Expected: FAIL — today's component renders a plain `View` docked flush with the bottom (no `position: 'absolute'`, no `bottom`/`height` matching the new constants, and `TAB_BAR_FLOAT_OFFSET`/`TAB_BAR_HEIGHT` aren't exported yet).

- [ ] **Step 3: Replace `FloatingTabBar.tsx` with the floating, glass, filled-icon version**

Replace the full contents of `mobile/src/components/FloatingTabBar.tsx` with:

```tsx
import { useRouter, usePathname } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'

import { useTheme, type ThemeTokens } from '@/theme/tokens'
import { TAB_DESTINATIONS, tabActiveForPath } from './tabDestinations'

/** Distance the pill floats above the bottom safe-area edge. */
export const TAB_BAR_FLOAT_OFFSET = 20
/** Fixed height of the floating pill. */
export const TAB_BAR_HEIGHT = 66

/**
 * Floating pill tab bar per the v2 design reference: glass surface, 16px side
 * insets, 20px above the bottom safe area, with a real outline→filled icon
 * swap on the active tab (not just a stroke-width/color change).
 */
export function FloatingTabBar() {
  const { tokens, scheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  return (
    <BlurView
      intensity={60}
      tint={scheme}
      style={[
        styles.bar,
        {
          bottom: insets.bottom + TAB_BAR_FLOAT_OFFSET,
          backgroundColor: tokens.glass.fill,
          borderColor: tokens.glass.border,
        },
        tokens.shadowFloat,
      ]}
    >
      {TAB_DESTINATIONS.map(({ path, label, icon: Icon, activeIcon: ActiveIcon }) => {
        const active = tabActiveForPath(path, pathname)
        const TabIcon = active ? ActiveIcon : Icon
        return (
          <Pressable
            key={path}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => router.replace(path)}
            style={styles.item}
          >
            <TabIcon size={21} color={active ? tokens.accent : tokens.muted} />
            <Text style={itemLabelStyle(tokens, active)}>{label}</Text>
          </Pressable>
        )
      })}
    </BlurView>
  )
}

function itemLabelStyle(tokens: ThemeTokens, active: boolean) {
  return {
    fontSize: 10,
    fontWeight: active ? ('700' as const) : ('500' as const),
    color: active ? tokens.accent : tokens.muted,
  }
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: TAB_BAR_HEIGHT,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: '100%',
  },
})
```

Note: the bar no longer needs the `accentSoft` active-pill background from the old docked version — the v2 reference marks the active tab purely by icon swap + color, not a background highlight.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- FloatingTabBar.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Manually sanity-check in the simulator**

The app is still running from Task 1's build. Reload it (JS-only change) and confirm: the tab bar now floats above the bottom edge with rounded corners and a frosted background, and the active tab shows a filled icon while inactive tabs show outline icons.

- [ ] **Step 7: Commit**

```bash
git add src/components/FloatingTabBar.tsx src/components/FloatingTabBar.test.tsx
git commit -m "feat(mobile): float the tab bar with glass surface and filled-icon active state"
```

---

### Task 7: Content clearance for the now-floating tab bar

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `TAB_BAR_FLOAT_OFFSET`, `TAB_BAR_HEIGHT` (Task 6).

Since the tab bar is now `position: 'absolute'` and overlaps content instead of pushing it up in flex flow, the content area needs bottom padding so the last row of any screen isn't hidden underneath the pill.

- [ ] **Step 1: Add bottom clearance to the content area**

Replace the full contents of `mobile/app/(tabs)/_layout.tsx` with:

```tsx
import { Slot } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AppHeader } from '@/components/AppHeader'
import {
  FloatingTabBar,
  TAB_BAR_FLOAT_OFFSET,
  TAB_BAR_HEIGHT,
} from '@/components/FloatingTabBar'
import { useTheme } from '@/theme/tokens'

/**
 * Five primary destinations, Calendar first and default (`index`). Renders
 * the persistent header and floating tab bar as chrome around whichever route
 * is active — a custom layout (not expo-router's built-in `<Tabs>` bar)
 * because the design reference's floating pill and title-less header don't
 * map onto the native tab bar's header/label conventions.
 */
export default function TabsLayout() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.root}>
      <AppHeader />
      <View
        style={[
          styles.content,
          { paddingBottom: insets.bottom + TAB_BAR_FLOAT_OFFSET + TAB_BAR_HEIGHT + 12 },
        ]}
      >
        <Slot />
      </View>
      <FloatingTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
})
```

Note: this task does not yet add the gradient background itself (Task 9 owns creating `GradientBackground` and mounting it in all 4 native screens, this file included) — it only adds the padding so Task 9's background isn't hidden underneath the tab bar once it lands.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors — this file has no dependency on anything from a later task.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/_layout.tsx
git commit -m "feat(mobile): add bottom content clearance for the floating tab bar"
```

---

### Task 8: FAB — sage gradient, repositioned above the floating bar

**Files:**
- Modify: `mobile/src/components/FloatingActionButton.tsx`

**Interfaces:**
- Consumes: `tokens.accentGradient` (Task 2), `TAB_BAR_FLOAT_OFFSET`, `TAB_BAR_HEIGHT` (Task 6).

Every screen that renders `<FloatingActionButton>` positions it via the component's own internal `bottom: 16` (no per-screen override) — so this is a single, self-contained change.

- [ ] **Step 1: Update the failing style expectation**

In `mobile/src/components/FloatingActionButton.test.tsx`, the existing assertion checks `{ width: 54, height: 54, position: 'absolute' }` — this doesn't reference `bottom` or color, so it stays valid unmodified. Run it first to confirm the baseline:

Run: `npm test -- FloatingActionButton.test.tsx`
Expected: PASS (baseline).

- [ ] **Step 2: Replace the solid fill with a sage gradient, and clear the floating tab bar**

Replace the full contents of `mobile/src/components/FloatingActionButton.tsx` with:

```tsx
import { Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { PlusIcon } from '@/components/icons'
import { TAB_BAR_FLOAT_OFFSET, TAB_BAR_HEIGHT } from '@/components/FloatingTabBar'
import { useTheme } from '@/theme/tokens'

interface FloatingActionButtonProps {
  accessibilityLabel: string
  onPress: () => void
  disabled?: boolean
}

const BOTTOM_OFFSET = TAB_BAR_FLOAT_OFFSET + TAB_BAR_HEIGHT + 12

/** Shared root-screen create action, positioned above the floating tab bar. */
export function FloatingActionButton({
  accessibilityLabel,
  onPress,
  disabled = false,
}: FloatingActionButtonProps) {
  const { tokens } = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <LinearGradient
        colors={tokens.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, tokens.shadowFloat]}
      >
        <PlusIcon size={24} strokeWidth={2} color={tokens.accentContrast} />
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    bottom: BOTTOM_OFFSET,
    zIndex: 20,
    width: 54,
    height: 54,
  },
  fill: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
})
```

- [ ] **Step 3: Add the `expo-linear-gradient` jest mock**

In `mobile/jest.setup.ts`, alongside the `expo-blur` mock added in Task 4, add:

```ts
// expo-linear-gradient ships a native view; tests just need something renderable.
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native')
  return { LinearGradient: View }
})
```

- [ ] **Step 4: Run the test to confirm it still passes**

Run: `npm test -- FloatingActionButton.test.tsx`
Expected: PASS — `width`/`height`/`position` are still on the outer `Pressable`'s style, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/FloatingActionButton.tsx jest.setup.ts
git commit -m "feat(mobile): sage gradient FAB, repositioned above the floating tab bar"
```

---

### Task 9: `GradientBackground` component + mount points

**Files:**
- Create: `mobile/src/components/GradientBackground.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Modify: `mobile/app/login.tsx`
- Modify: `mobile/app/settings.tsx`
- Modify: `mobile/app/notifications.tsx`

**Interfaces:**
- Consumes: `tokens.gradientColors`, `tokens.glow` (Task 2).
- Produces: `GradientBackground` — a self-contained, absolute-fill component with no props, safe to mount as the first child of any screen's root.

`login`, `settings`, and `notifications` are each their own top-level `Stack.Screen` (see `app/_layout.tsx`'s `RootNavigator`, `settings`/`notifications` use `presentation: 'card'`) — i.e., separate native screens, not React siblings of `(tabs)`. A background mounted once at the app root would not composite behind them, so `GradientBackground` must be mounted inside each of the 4 independently-navigated screens: `(tabs)/_layout.tsx` (covers all 5 tabs and their nested detail routes, since those share one `Slot`), `login.tsx`, `settings.tsx`, `notifications.tsx`.

- [ ] **Step 1: Create the component**

Create `mobile/src/components/GradientBackground.tsx`:

```tsx
import { StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { useTheme } from '@/theme/tokens'

/**
 * Diagonal gradient + two soft radial glows, mounted once per independently-
 * navigated native screen (see the v2 design reference). Renders behind all
 * content — every screen using it must keep its own background transparent.
 */
export function GradientBackground() {
  const { tokens } = useTheme()

  return (
    <>
      <LinearGradient
        colors={tokens.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="glowPrimary" cx="85%" cy="8%" r="60%">
            <Stop offset="0%" stopColor={tokens.glow.primary} stopOpacity={1} />
            <Stop offset="100%" stopColor={tokens.glow.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowSecondary" cx="8%" cy="80%" r="55%">
            <Stop offset="0%" stopColor={tokens.glow.secondary} stopOpacity={1} />
            <Stop offset="100%" stopColor={tokens.glow.secondary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="85%" cy="8%" r="35%" fill="url(#glowPrimary)" />
        <Circle cx="8%" cy="80%" r="32%" fill="url(#glowSecondary)" />
      </Svg>
    </>
  )
}
```

- [ ] **Step 2: Mount in `(tabs)/_layout.tsx`, `login.tsx`, `settings.tsx`, `notifications.tsx`**

In `mobile/app/(tabs)/_layout.tsx` (last edited in Task 7), add the import:

```ts
import { GradientBackground } from '@/components/GradientBackground'
```

and render `<GradientBackground />` as the first child of the root `View`, immediately before `<AppHeader />`:

```tsx
    <View style={styles.root}>
      <GradientBackground />
      <AppHeader />
```

In each of `login.tsx`, `settings.tsx`, `notifications.tsx`, add the same import:

```ts
import { GradientBackground } from '@/components/GradientBackground'
```

and render `<GradientBackground />` as the first child inside the existing `SafeAreaView`, e.g. in `login.tsx`:

```tsx
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
      <GradientBackground />
      {/* ...existing content unchanged... */}
```

Apply the same pattern (add the import, add `<GradientBackground />` as the first child, change that file's `backgroundColor: tokens.canvas` to `backgroundColor: 'transparent'`) to `settings.tsx` and `notifications.tsx` at their respective `SafeAreaView` lines (`app/settings.tsx:139`, `app/notifications.tsx:48`).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify in the simulator**

Reload the app (still the Task 1 build). Confirm: Schedule/Groceries/Ledger/Notes/Trips tabs, Login, Settings, and Notifications all show the diagonal gradient with two soft glows instead of a flat white/dark background.

- [ ] **Step 5: Commit**

```bash
git add src/components/GradientBackground.tsx app/\(tabs\)/_layout.tsx app/login.tsx app/settings.tsx app/notifications.tsx
git commit -m "feat(mobile): add gradient+glow background, mount on all 4 native screens"
```

---

### Task 10: Make every screen's own background transparent

**Files:**
- Modify: `mobile/src/components/PlaceholderScreen.tsx:20`
- Modify: `mobile/app/(tabs)/index.tsx:189`
- Modify: `mobile/app/(tabs)/ledger/index.tsx:56`
- Modify: `mobile/app/(tabs)/ledger/[yearId].tsx:114,126,133,164`
- Modify: `mobile/app/(tabs)/notes/index.tsx:87`
- Modify: `mobile/app/(tabs)/notes/[noteId].tsx:47,54,105`
- Modify: `mobile/app/(tabs)/groceries/index.tsx:97`
- Modify: `mobile/app/(tabs)/groceries/[listId].tsx:200`
- Modify: `mobile/app/(tabs)/trips/index.tsx:70`
- Modify: `mobile/app/(tabs)/trips/[tripId].tsx:95`

**Interfaces:**
- Consumes: `GradientBackground` mounted in `(tabs)/_layout.tsx` (Task 9) — these screens sit inside that same `Slot`, so they only need to stop painting an opaque background over it.

Every line below is the same one-line change: `backgroundColor: tokens.canvas` → `backgroundColor: 'transparent'` inside a `SafeAreaView`'s style array. Do **not** touch `src/features/trips/TripDateRangeField.tsx:127` (a modal popover that should stay opaque) or `src/features/ledger/BudgetMonthSelector.tsx:119` (uses `tokens.canvas` as a text color, not a background — leave untouched).

- [ ] **Step 1: Apply the transparency change to all 12 files**

For each file/line listed above, change:
```tsx
{ backgroundColor: tokens.canvas }
```
to:
```tsx
{ backgroundColor: 'transparent' }
```
within that file's `SafeAreaView` style array (the surrounding code — `edges={['bottom']}`, `styles.safe`, etc. — is unchanged).

- [ ] **Step 2: Typecheck and run the full test suite**

Run: `npm run typecheck && npm test`
Expected: no type errors; all tests still pass (no test asserts on `tokens.canvas` as a rendered background color).

- [ ] **Step 3: Manually verify in the simulator**

Reload. Navigate to all 5 tabs, into a detail screen for each (a grocery list, a ledger year, a note, a trip), Settings, and Notifications. Confirm the gradient background from Task 9 is visible behind every one of them, with no stray opaque white/dark rectangle anywhere.

- [ ] **Step 4: Commit**

```bash
git add src/components/PlaceholderScreen.tsx app/\(tabs\)/index.tsx app/\(tabs\)/ledger/index.tsx app/\(tabs\)/ledger/\[yearId\].tsx app/\(tabs\)/notes/index.tsx app/\(tabs\)/notes/\[noteId\].tsx app/\(tabs\)/groceries/index.tsx app/\(tabs\)/groceries/\[listId\].tsx app/\(tabs\)/trips/index.tsx app/\(tabs\)/trips/\[tripId\].tsx
git commit -m "feat(mobile): make every screen background transparent to reveal the gradient"
```

---

### Task 11: Web accent parity

**Files:**
- Modify: `src/styles/theme.css` (repo root, **not** `mobile/`)

**Interfaces:**
- None — this is an isolated CSS custom-property value change with no code depending on it beyond the cascade.

- [ ] **Step 1: Update the accent variables in all three blocks**

In `src/styles/theme.css`, there are 3 occurrences of `--hh-accent: #ff7a45;` (the `:root` block, the `@media (prefers-color-scheme: dark)` block, and the `[data-appearance='dark']` block) and matching `--hh-accent-soft` lines. Change each:

```css
  --hh-accent: #ff7a45;
```
to:
```css
  --hh-accent: #6f9483;
```

and, in the `:root` block:
```css
  --hh-accent-soft: rgba(255, 122, 69, 0.14);
```
to:
```css
  --hh-accent-soft: rgba(111, 148, 131, 0.14);
```

and in both dark blocks (`@media` and `[data-appearance='dark']`):
```css
  --hh-accent-soft: rgba(255, 122, 69, 0.22);
```
to:
```css
  --hh-accent-soft: rgba(111, 148, 131, 0.22);
```

Leave `--hh-accent-contrast` unchanged in all 3 blocks (`#ffffff` light, `#14151a` dark) — same contrast-role assignment as native, only the underlying hue changes.

- [ ] **Step 2: Run the web build and test suite**

Run (from the repo root, **not** `mobile/`): `npm run build && npm test`
Expected: both succeed — this is a CSS custom-property value change only, nothing references the literal hex in JS/TS.

- [ ] **Step 3: Commit**

```bash
git add src/styles/theme.css
git commit -m "style(web): update accent to sage for native/web parity"
```

---

### Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Native typecheck, lint, full test suite**

Run (from `mobile/`):
```bash
npm run typecheck
npm test
```
Expected: both clean.

- [ ] **Step 2: Repo-root lint and web build/test (if a root lint script exists)**

Run (from the repo root):
```bash
npm run build
npm test
```
Expected: both clean (web build/tests were already run in Task 11; re-run here only if other tasks touched anything under `src/`, which they don't — this step is a final confirmation, not new work).

- [ ] **Step 3: Manual simulator QA — light mode**

Using the Task 1 dev-client build (all subsequent tasks were JS-only, so a simple reload picks them up), walk:
- All 5 tabs: gradient + glow background visible, glass Card surfaces on calendar/section/notes cards, flat translucent row surfaces on event/checklist/category rows.
- Floating tab bar: pill floats above the bottom edge, active tab shows a filled icon in sage, inactive tabs show outline icons in muted gray.
- Header: glass circular back/bell/gear buttons, transparent header background.
- FAB (Schedule/Groceries/Ledger/Notes/Trips): sage gradient fill, sits clear of the floating tab bar.
- Settings, Notifications, Login: gradient background visible, no stray opaque rectangles.
- Checklist checkbox checked-state and calendar "today" circle: sage fill (verify no leftover orange anywhere — this was the primary accent's only remaining reference).

- [ ] **Step 4: Manual simulator QA — dark mode**

Toggle the simulator (or the app's own appearance setting, if exposed in Settings) to dark and repeat the same walk. Confirm the dark gradient/glow and dark glass surfaces read as a coherent dark-mode counterpart (not a jarring mix of old and new).

- [ ] **Step 5: Confirm no orange remains outside the intentionally-untouched data palette**

Run: `grep -rn "FF7A45\|ff7a45" mobile/src mobile/app mobile/app.json src/styles/theme.css`
Expected: zero matches (the only remaining `#FF7A45`-family reference in the whole repo should be the untouched `StatementCharts.tsx` `COLORS` array, which this grep doesn't even target since it's a different literal per Task's non-goals — if it appears, it means something was missed).
