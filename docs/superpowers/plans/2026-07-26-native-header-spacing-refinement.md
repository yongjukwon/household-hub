# Native Header and Spacing Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Balance Calendar header spacing, compact the collapsed Budget month selector, and move detail back navigation into the shared native header.

**Architecture:** Keep visual metrics in the focused Calendar and Budget components. Extend the existing route-title helper with an explicit detail-route parent mapping, then let `AppHeader` render the one shared back action. Detail screens remove their duplicate content-level back rows.

**Tech Stack:** Expo SDK 57, Expo Router, React Native, TypeScript, Jest, React Native Testing Library.

## Global Constraints

- Keep the five primary tabs and existing route paths unchanged.
- Keep Notification and Settings actions at the upper right.
- Keep the page title geometrically centered independent of header actions.
- Use an icon-only 36-point header back surface with at least a 44-point effective target.
- Use `router.replace` to return to the owning root tab.
- Keep Budget navigation controls at least 44 points tall.
- Do not change domain, persistence, server, web, or production behavior.

---

### Task 1: Shared header back navigation

**Files:**
- Modify: `mobile/src/components/appHeaderTitle.ts`
- Modify: `mobile/src/components/AppHeader.tsx`
- Modify: `mobile/src/components/AppHeader.test.tsx`
- Modify: `mobile/app/(tabs)/groceries/[listId].tsx`
- Modify: `mobile/app/(tabs)/ledger/[yearId].tsx`
- Modify: `mobile/app/(tabs)/notes/[noteId].tsx`
- Modify: `mobile/app/(tabs)/trips/[tripId].tsx`

**Interfaces:**
- Produces: `backDestinationForPath(pathname: string): { path: '/groceries' | '/ledger' | '/notes' | '/trips'; label: string } | null`
- Consumes: Expo Router `router.replace`, existing `ChevronLeftIcon`, and existing title routing.

- [ ] **Step 1: Write failing route and header behavior tests**

Extend `AppHeader.test.tsx` with literal expectations for all detail routes and
root routes:

```tsx
expect(backDestinationForPath('/groceries/list-id')).toEqual({
  path: '/groceries',
  label: 'Back to Groceries',
})
expect(backDestinationForPath('/ledger/year-id')).toEqual({
  path: '/ledger',
  label: 'Back to Ledger',
})
expect(backDestinationForPath('/notes/note-id')).toEqual({
  path: '/notes',
  label: 'Back to Notes',
})
expect(backDestinationForPath('/trips/trip-id')).toEqual({
  path: '/trips',
  label: 'Back to Trips',
})
expect(backDestinationForPath('/groceries')).toBeNull()
```

Render `AppHeader` on `/ledger/year-id`, press `Back to Ledger`, and assert
that the real header calls `router.replace('/ledger')`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd mobile
npm test -- --runInBand src/components/AppHeader.test.tsx
```

Expected: fail because `backDestinationForPath` and the shared header back
button do not exist.

- [ ] **Step 3: Implement the route mapping and shared button**

Add the explicit route map:

```ts
export function backDestinationForPath(pathname: string) {
  if (/^\/groceries\/[^/]+$/.test(pathname)) {
    return { path: '/groceries' as const, label: 'Back to Groceries' }
  }
  if (/^\/ledger\/[^/]+$/.test(pathname)) {
    return { path: '/ledger' as const, label: 'Back to Ledger' }
  }
  if (/^\/notes\/[^/]+$/.test(pathname)) {
    return { path: '/notes' as const, label: 'Back to Notes' }
  }
  if (/^\/trips\/[^/]+$/.test(pathname)) {
    return { path: '/trips' as const, label: 'Back to Trips' }
  }
  return null
}
```

In `AppHeader`, replace the empty left spacer with either the circular back
button or the same-width spacer:

```tsx
{backDestination ? (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={backDestination.label}
    hitSlop={4}
    onPress={() => router.replace(backDestination.path)}
    style={[styles.iconButton, { backgroundColor: tokens.card }, tokens.shadowCard]}
  >
    <ChevronLeftIcon size={18} color={tokens.muted} />
  </Pressable>
) : (
  <View style={styles.leftSpacer} />
)}
```

Keep the absolute centered-title layer and right-side actions unchanged.

- [ ] **Step 4: Remove duplicate detail-screen back rows**

Delete the local chevron/text rows, unused imports, and `backRow`/`backLabel`
styles from Grocery, Budget, Note, and Trip detail routes. Keep all other
screen-specific title, edit, delete, and empty/error controls.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
cd mobile
npm test -- --runInBand src/components/AppHeader.test.tsx
npm run typecheck
```

Expected: the header suite and TypeScript pass.

### Task 2: Calendar and Budget visual density

**Files:**
- Modify: `mobile/src/features/calendar/layout.ts`
- Modify: `mobile/src/features/calendar/layout.test.ts`
- Modify: `mobile/app/(tabs)/index.tsx`
- Modify: `mobile/src/features/ledger/BudgetMonthSelector.tsx`
- Modify: `mobile/src/features/ledger/BudgetMonthSelector.test.tsx`

**Interfaces:**
- Produces: `CALENDAR_MONTH_HEADER_BOTTOM_SPACING = 14`
- Preserves: `BudgetMonthSelector({ month, onChange })`

- [ ] **Step 1: Write failing layout tests**

Add a Calendar expectation:

```ts
expect(CALENDAR_MONTH_HEADER_BOTTOM_SPACING).toBe(14)
```

Extend the Budget selector test to render July and verify both arrow controls
and the month-label control retain at least a 44-point touch surface after the
visual compaction.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd mobile
npm test -- --runInBand \
  src/features/calendar/layout.test.ts \
  src/features/ledger/BudgetMonthSelector.test.tsx
```

Expected: Calendar fails because the spacing export is absent; Budget fails
until the compact styles and test selectors are present.

- [ ] **Step 3: Apply Calendar spacing**

Export `CALENDAR_MONTH_HEADER_BOTTOM_SPACING = 14` from `layout.ts`, import it
into the Calendar screen, and use it as `monthRow.marginBottom`. Do not alter
date cells, weekday spacing, dot geometry, or today's marker.

- [ ] **Step 4: Compact the collapsed Budget selector**

Keep 44-point pressable surfaces and change only visual density:

```ts
navigator: {
  minHeight: 48,
  paddingHorizontal: 6,
  paddingVertical: 2,
}
arrowButton: { width: 44, height: 44 }
monthLabelButton: { minHeight: 44 }
monthLabel: { fontSize: 16, fontWeight: '800' }
```

Render both chevrons at 18 points. Leave the expanded month grid unchanged.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
cd mobile
npm test -- --runInBand \
  src/features/calendar/layout.test.ts \
  src/features/ledger/BudgetMonthSelector.test.tsx
```

Expected: both suites pass.

### Task 3: Verification, progress ledger, and publication

**Files:**
- Modify: `progress.md`
- Modify: `docs/superpowers/progress-detail.md`

**Interfaces:**
- Consumes: completed Tasks 1 and 2.
- Produces: a verified implementation commit and draft PR targeting `calendar`.

- [ ] **Step 1: Run the complete native checks**

```bash
cd mobile
npm test -- --runInBand
npm run typecheck
npx expo-doctor
npx expo export --platform ios --output-dir "$(mktemp -d)"
npx expo export --platform android --output-dir "$(mktemp -d)"
```

Expected: 0 failing suites, no type errors, Expo Doctor 20/20, and successful
iOS and Android exports.

- [ ] **Step 2: Run repository checks**

```bash
cd ..
npm run lint
npm run build
npm test -- --run
npm run test:functions
```

Expected: all commands exit 0.

- [ ] **Step 3: Update continuation documentation**

Record the shared header back action, Calendar spacing, compact Budget
selector, test counts, and remaining physical-device acceptance. Do not mark
Task 9 complete.

- [ ] **Step 4: Audit and commit intended scope**

Inspect `git status -sb`, `git diff --stat`, and `git diff --check`. Preserve
unrelated user files and stage only the Household Hub rebuild/correction files
intended for this branch. Commit with a terse message describing the completed
mobile-first rebuild and corrections.

- [ ] **Step 5: Push and open a draft PR**

Push `codex/household-hub-mobile-first` to `origin` and open a draft PR
targeting `calendar`. The PR body must summarize the shared foundation,
web/native parity, offline queue, Trip completion, UI corrections, verification
evidence, and Task 9 device/release boundary.
