# Mobile v2 glassmorphism theme design

**Date:** 2026-07-26

**Status:** Approved

## Goal

Re-skin the native mobile app's visual system — background, surface
treatment, primary accent — to the v2 Claude Design reference
(`docs/mobile-design-reference/v2/`): a soft diagonal gradient background
with glassmorphism surfaces and a sage primary accent. Convert the bottom
tab bar from docked to floating, with a real outline→filled icon swap per
tab. Keep all current feature codes, features, and behaviour — no change to
component locations, navigation structure, or screen composition.

The web app's accent token also updates to the same sage, to preserve the
native/web accent parity established by
`2026-07-26-white-canvas-tonal-surfaces-design.md`. Web's flat/Swiss surface
treatment (canvas, cards, layout, typography) is otherwise untouched — this
is a native-only reskin.

## Palette — native, light

| Token | Old | New |
| --- | --- | --- |
| canvas | `#FFFFFF` flat | diagonal gradient `#eef2ef → #f7f2ea → #eef1f5` (160deg) + two subtle radial glows: sage top-right `rgba(143,168,159,0.22)`, warm peach bottom-left `rgba(255,157,102,0.15)` — alphas toned down from the mockup's `.35`/`.25` (kept subtle, not vivid) |
| accent (primary) | `#FF7A45` | `#6F9483` |
| accentSecondary (new token) | — | `#8FA89F` (calendar card left-border, active segmented-control fill) |
| card / list-row surfaces | flat `#F6F7F9` / `#EFF0F2` | glass: `rgba(255,255,255,.65–.7)` fill, `rgba(255,255,255,.75–.8)` border, blur 14–22px via `expo-blur`, applied to every Card and list row (full v2 fidelity) |
| header icon buttons | flat `tokens.card` | glass circle, blur ~10px |
| tab bar | flat `tokens.card`, docked | glass pill, blur ~22px, floating |

## Palette — native, dark

The v2 reference only specs light mode; dark is an extrapolation that keeps
the same design language rather than staying flat/solid.

| Token | Old | New |
| --- | --- | --- |
| canvas | `#0F1014` flat | dark diagonal gradient analog (deep charcoal/sage-tinted) + the same two glows at lower alpha: sage `rgba(143,168,159,0.14)`, peach `rgba(255,157,102,0.10)` |
| accent | `#FF7A45` | `#6F9483` (unchanged across modes) |
| accentSecondary | — | `#8FA89F` |
| card / surfaces | flat dark | frosted dark glass: `rgba(255,255,255,.08)` fill / `rgba(255,255,255,.12)` border, dark-tint blur |

## Explicitly unchanged

- The 6-color ledger/statement category palette (`tokens.data`, and the
  separate hardcoded array in `StatementCharts.tsx`) — data/category
  color-coding, not theme.
- All component locations, navigation structure, screens, and feature
  behavior.
- Typography/fonts, spacing, and radii (only background, glass surface
  treatment, and accent colors change).

## Floating tab bar

- Position: absolute, 20px above the bottom safe area, 16px side insets,
  ~66px height, 26px radius.
- Glass surface as above.
- Active tab: real outline→filled icon swap for all 5 tabs (path data
  extracted from the v2 html for calendar/cart/book/notepad/plane),
  replacing today's single-icon stroke-width/color toggle. Header-only
  icons (bell/gear) stay outline-only, matching the reference.
- The scrollable content area gains bottom padding sized to the tab bar's
  height + float offset + margin, since the bar now overlaps content
  instead of pushing it up in flex flow — a mechanical consequence of going
  floating, not a layout change.

## FAB

Recolored to a sage gradient (135deg, `#6F9483` → a lighter sage tint),
replacing today's flat solid orange fill. The v2 mockup itself left the
FAB's gradient as old warm orange/peach (an apparent leftover from an
earlier draft); recoloring to sage was chosen for full accent consistency.

## Components touched (native)

- `theme/tokens.ts` — palette above, new `accentSecondary` token, glass/blur
  shadow tokens.
- `Card.tsx` — renders via `BlurView` instead of a flat `View` fill.
- `AppHeader.tsx` — icon buttons become glass circles.
- `FloatingTabBar.tsx` — floating position, glass pill, filled-icon swap.
- `icons.tsx` — add 5 filled icon variants (schedule/groceries/ledger/notes/trips).
- `FloatingActionButton.tsx` — sage gradient fill.
- New: a gradient + glow background mounted once at the app root
  (`app/_layout.tsx`), replacing the per-screen `backgroundColor:
  tokens.canvas` fills currently in `(tabs)/_layout.tsx`, `login.tsx`,
  `settings.tsx`, `notifications.tsx`.
- `app.json` — add `expo-blur` / `expo-linear-gradient`; update
  `expo-notifications`'s icon color to `#6F9483`.
- `package.json` — new deps `expo-blur`, `expo-linear-gradient`.
- `tokens.test.ts` — update expected accent hex and add coverage for the new
  `accentSecondary` token.

## Web (parity only)

- `src/styles/theme.css` — `--hh-accent` (root + both dark blocks) and
  `--hh-accent-soft` → sage, matching alpha. No other web change: canvas,
  surfaces, layout, and typography stay exactly as they are today.

## Mechanics / rollout

- Adding `expo-blur` and `expo-linear-gradient` requires `expo prebuild` +
  rebuilding the dev client (`expo run:ios`, later `run:android`) before the
  new theme is visible in the simulator — a few minutes for the first
  build; JS-only edits after that reload instantly as usual.
- Update any component tests that assert on the old solid colors/style
  structure (`AppHeader.test.tsx`, and `FloatingTabBar`/`Card`/
  `FloatingActionButton` tests if they exist).

## Validation

- Update/run the native token-contract test (`tokens.test.ts`) against the
  new palette.
- Re-run native component tests for `Card`, `AppHeader`, `FloatingTabBar`,
  and `FloatingActionButton`, since all consume the changed tokens/structure.
- Run native TypeScript, lint, and the full native test suite.
- Run the web build + test suite (the `theme.css` change only touches a CSS
  custom property value).
- Manually verify in the iOS simulator, light and dark: all 5 tabs, floating
  bar overlap/content padding, header icon glass, calendar card left-border
  accent, FAB gradient, checklist checkbox states, and empty states.
