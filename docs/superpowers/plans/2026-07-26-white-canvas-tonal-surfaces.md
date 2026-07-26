# White canvas and tonal surfaces implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved white/light-gray and near-black/dark-gray surface hierarchy consistently to web and native semantic tokens.

**Architecture:** Both clients already consume a three-level semantic surface system. Change only those shared token values, protect the contract with native tests, and rely on existing component consumption rather than editing individual screens.

**Tech Stack:** React Native, Expo SDK 57, CSS custom properties, Jest, Vitest, TypeScript, Vite.

## Global constraints

- Preserve the orange accent and data palette.
- Preserve current spacing, radii, shadows, component APIs, and layouts.
- Keep web and native token values identical.
- Do not change database, operations, authentication, deployment, or user data.
- Preserve unrelated modified and untracked files.

### Task 1: Protect and update semantic surfaces

**Files:**
- Create: `mobile/src/theme/tokens.test.ts`
- Modify: `mobile/src/theme/tokens.ts`
- Modify: `src/styles/theme.css`

**Produces:** Identical web/native Canvas, primary-surface, and
secondary-surface values for light and dark modes.

- [ ] Write a failing test asserting the approved token values and proving
  `canvas`, `card`, and `cardAlt` are distinct in each theme.
- [ ] Run `npm --prefix mobile test -- --runInBand src/theme/tokens.test.ts`
  and verify it fails against the old palette.
- [ ] Update native `lightTokens` and `darkTokens`.
- [ ] Update `--hh-canvas`, `--hh-surface`, `--hh-surface-2`, and dark
  `--hh-line` in both web dark-mode blocks.
- [ ] Re-run the focused test and verify it passes.
- [ ] Commit with `style: add tonal surface hierarchy`.

### Task 2: Verify and document

**Files:**
- Modify: `progress.md`
- Modify: `docs/superpowers/progress-detail.md`

- [ ] Run `npm --prefix mobile test -- --runInBand`.
- [ ] Run `npm --prefix mobile run typecheck`.
- [ ] Run `npm run test -- --run`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check -- mobile src progress.md docs/superpowers`.
- [ ] Record exact verification results and remaining device visual review.
- [ ] Commit with `docs: record tonal surface update`.
