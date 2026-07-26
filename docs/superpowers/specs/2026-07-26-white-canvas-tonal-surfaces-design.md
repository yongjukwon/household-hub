# White canvas and tonal surfaces design

**Date:** 2026-07-26

**Status:** Approved

## Goal

Give light mode a clean white background while keeping buttons, controls, and
content surfaces visibly separated. Give dark mode the same tonal-elevation
relationship instead of simply inverting the light palette.

## Semantic hierarchy

| Token | Light | Dark |
| --- | --- | --- |
| Canvas | `#FFFFFF` | `#0F1014` |
| Primary surface | `#F6F7F9` | `#191B22` |
| Secondary/control surface | `#EFF0F2` | `#242731` |
| Primary text | `#14151A` | `#F4F5F8` |
| Divider/border | `rgba(20, 21, 26, 0.08)` | `rgba(255, 255, 255, 0.09)` |
| Accent | `#FF7A45` | `#FF7A45` |

The hierarchy is:

`canvas → primary surface → secondary/control surface`

Each level must be visually distinct in both themes. Light mode uses darker
tonal surfaces over white. Dark mode uses progressively lighter surfaces over
a near-black canvas.

## Scope

- Update the native semantic tokens.
- Update the equivalent web CSS variables to preserve web/native parity.
- Preserve typography, spacing, radii, icons, data colors, destructive colors,
  and selected-state behavior.
- Preserve the current colored Budget summary backgrounds.
- Keep existing borders and shadows; the tonal change provides the primary
  separation, while current borders and shadows remain secondary cues.
- Do not change individual screen layouts or component APIs.

## Validation

- Add a native token-contract test proving the three surface levels are
  distinct and use the approved values in both themes.
- Re-run native component tests because every native surface consumes these
  tokens.
- Run native TypeScript, repository lint, web tests, and the production web
  build.
- Manually review Calendar, Groceries, Ledger, Notes, Trips, forms, and dark
  mode on iPhone before release.
