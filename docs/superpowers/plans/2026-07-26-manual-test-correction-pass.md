# Manual-Test Correction Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every finding in `progress.md`'s "Next correction pass — manual-test findings" section (Calendar, Groceries, Ledger, Notes, general mobile layout/forms) so Task 9 can start.

**Architecture:** Each finding is fixed at its root: the web app (`src/`) and the Expo app (`mobile/`) carry parallel, near-duplicate feature implementations (this is the codebase's established convention — pure logic is ported file-for-file, not always factored into `packages/domain`), so most findings need a matching edit on both platforms. Two genuinely shared pieces of logic move into `packages/domain` because both platforms need byte-identical output (owner-color assignment must be deterministic across devices).

**Tech Stack:** Vite + React 19 + TypeScript + Tailwind v4 (web); Expo/React Native + TypeScript (mobile); Vitest (web/domain tests); Jest + `@testing-library/react-native` (mobile tests); Supabase/Postgres.

## Global Constraints

- Work only in `/Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first` (per `progress.md`'s resume checklist).
- Do not touch `DEPLOYMENT.md`, `docs/mobile-design-reference/`, or `docs/mobile-implementation-handoff.md`.
- Do not start any Task 9 work (physical-device testing, production config, production reset) until every task below is complete and accepted.
- Preserve the existing server-side 4-digit year check (`supabase/migrations/20260725010000_mobile_first_schema.sql:213`, RPC validation in `20260725011000_household_operation_rpc.sql:1075`) — no migration changes in this plan.
- Resolved product decisions from the user (do not re-litigate):
  - Grocery price history shows the **5 cheapest purchases ever recorded** for that item (all retained history, not just recent ones), sorted cheapest → most expensive, each row showing its purchase date.
  - The compact replacement for mobile's wheel/scroll pickers is a **tap-to-open dropdown/select menu** (minimal footprint closed, opens a menu on tap, closes on selection).
- Run task-by-task, **in the order listed** — several tasks touch the same mobile screen files (`mobile/app/(tabs)/index.tsx`, `.../ledger/index.tsx`, `.../notes/index.tsx`, `.../trips/index.tsx`, `.../groceries/index.tsx`) for different reasons; running them out of order risks one task's subagent editing stale content. Do not parallelize tasks that share a file.
- After each task: run the relevant test suite (`npm run test` for web/domain, `cd mobile && npm test` for mobile) and `npm run lint` before moving on.

---

### Task 1: Shared owner-color utility in `packages/domain`

**Files:**
- Modify: `packages/domain/src/calendar.ts`
- Modify: `packages/domain/src/calendar.test.ts`

**Interfaces:**
- Produces: `buildOwnerColors(members: { userId: string; displayName: string }[], currentUserId: string | null): OwnerColors`, where `OwnerColors = { colorFor: (ownerId: string | null) => string; labelFor: (ownerId: string | null) => string }`. `ownerId === null` means "Shared". Colors are deterministic by sorted `userId` so both partners see the same person in the same color on both platforms.

This ports the already-battle-tested logic that exists (dead, unrouted) at `src/lib/calendar.ts:159-207`, minus the `legend` field (no longer needed — Calendar finding 2 puts the owner indicator on each event row, not in a legend).

- [ ] **Step 1: Write the failing test**

Add to `packages/domain/src/calendar.test.ts` (new `describe` block, keep existing imports from `./index` and add `buildOwnerColors`):

```ts
import {
  buildOwnerColors,
  calendarDateInTimeZone,
  isCalendarTime,
  isReminderPreset,
  reminderLeadMinutes,
  reminderPresets,
  type CalendarTime,
} from './index'

describe('buildOwnerColors', () => {
  const members = [
    { userId: 'b-user', displayName: 'Claire' },
    { userId: 'a-user', displayName: 'Yongju' },
  ]

  it('assigns colors by sorted user id, stable regardless of input order', () => {
    const colors = buildOwnerColors(members, null)
    expect(colors.colorFor('a-user')).not.toBe(colors.colorFor('b-user'))
    expect(colors.colorFor('a-user')).toBe(buildOwnerColors([...members].reverse(), null).colorFor('a-user'))
  })

  it('gives shared events their own color, distinct from either member', () => {
    const colors = buildOwnerColors(members, null)
    const shared = colors.colorFor(null)
    expect(shared).not.toBe(colors.colorFor('a-user'))
    expect(shared).not.toBe(colors.colorFor('b-user'))
  })

  it('labels the current user "You" and the partner by display name', () => {
    const colors = buildOwnerColors(members, 'a-user')
    expect(colors.labelFor('a-user')).toBe('You')
    expect(colors.labelFor('b-user')).toBe('Claire')
    expect(colors.labelFor(null)).toBe('Shared')
  })

  it('falls back to the shared color for an unknown owner id', () => {
    const colors = buildOwnerColors(members, null)
    expect(colors.colorFor('missing-user')).toBe(colors.colorFor(null))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/domain -- calendar.test.ts` (or `cd packages/domain && npx vitest run calendar.test.ts`)
Expected: FAIL with `buildOwnerColors is not a function` / import error.

- [ ] **Step 3: Add the implementation**

Append to `packages/domain/src/calendar.ts`:

```ts
// --- Owner attribution colors ---------------------------------------------

/** Distinct, dot-legible hues; Shared ties to the app's amber accent family. */
const OWNER_COLOR_A = '#3b5bdb' // indigo
const OWNER_COLOR_B = '#c2255c' // raspberry
const OWNER_COLOR_SHARED = '#d9a400' // deep gold (brand-adjacent)

export interface OwnerColors {
  /** Color for an event's owner_id (null = shared). */
  colorFor: (ownerId: string | null) => string
  /** Display label for an event's owner_id ("You" / name / "Shared"). */
  labelFor: (ownerId: string | null) => string
}

/**
 * Deterministically map the (exactly two) household members to two colors by
 * sorted user id, plus a third for Shared. Stable across sessions/devices so
 * both partners see the same person in the same color on web and native.
 */
export function buildOwnerColors(
  members: { userId: string; displayName: string }[],
  currentUserId: string | null,
): OwnerColors {
  const sorted = [...members].sort((a, b) => a.userId.localeCompare(b.userId))
  const palette = [OWNER_COLOR_A, OWNER_COLOR_B]
  const byUser = new Map<string, string>()
  sorted.forEach((m, i) => byUser.set(m.userId, palette[i] ?? OWNER_COLOR_A))

  const colorFor = (ownerId: string | null) =>
    ownerId === null ? OWNER_COLOR_SHARED : (byUser.get(ownerId) ?? OWNER_COLOR_SHARED)

  const labelFor = (ownerId: string | null) => {
    if (ownerId === null) return 'Shared'
    if (ownerId === currentUserId) return 'You'
    return members.find((m) => m.userId === ownerId)?.displayName ?? 'Shared'
  }

  return { colorFor, labelFor }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/domain && npx vitest run calendar.test.ts`
Expected: PASS, all 4 new cases plus existing ones green.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/calendar.ts packages/domain/src/calendar.test.ts
git commit -m "feat(domain): add buildOwnerColors for calendar owner attribution"
```

---

### Task 2: Calendar — web event-row owner attribution

**Files:**
- Modify: `src/features/calendar/CalendarScreen.tsx`
- Test: `src/test/CalendarScreen.test.tsx` (create — none currently exists for this screen)

**Interfaces:**
- Consumes: `buildOwnerColors` from `@household-hub/domain` (Task 1), `useAuth()` from `@/hooks/useAuth` (`user?.id`).

Web has no legend to remove (confirmed: zero matches for "legend" in `src/features/calendar/`), but it also has no owner indicator anywhere — the selected-date event list (`CalendarScreen.tsx:209-228`) shows only time + title. This task adds the owner dot + label to each event row for parity with the requirement ("preserve the distinction between Yongju, Claire, and Shared at the event row level").

- [ ] **Step 1: Write the failing test**

Create `src/test/CalendarScreen.test.tsx` (check `src/test/` for the household/query mocking pattern another screen test uses, e.g. `src/test/TripScreen.test.tsx`, and mirror it). Minimum assertion:

```tsx
it('shows each event owner as a colored label in the selected-day list', async () => {
  // render CalendarScreen with a household of two members and one event
  // owned by the non-current member, one shared event (ownerId: null)
  // assert the owned event's row contains that member's displayName
  // assert the shared event's row contains the text "Shared"
})
```

(Write the full test using this repo's existing mocking conventions from `TripScreen.test.tsx` — mock `useActiveHousehold`, `useCalendarEvents`, and `useAuth` the same way that file mocks its equivalents, with two members and two events as described above.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/CalendarScreen.test.tsx`
Expected: FAIL — no owner text/color present in the rendered row.

- [ ] **Step 3: Implement**

In `src/features/calendar/CalendarScreen.tsx`, add the import and hook, then extend the event row. Current row (lines 209-228):

```tsx
<ul className="space-y-2">
  {selectedEvents.map((event) => (
    <li key={event.id}>
      <button
        type="button"
        onClick={() => openEvent(event)}
        className="flex w-full items-center gap-3 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 text-left shadow-[var(--hh-shadow-card)]"
      >
        <span className="text-sm font-medium tabular-nums text-[var(--hh-muted)]">
          {event.allDay || !event.startsAt
            ? 'All day'
            : formatEventTime(event.startsAt, tz)}
        </span>
        <span className="flex-1 font-medium text-[var(--hh-ink)]">
          {event.title}
        </span>
      </button>
    </li>
  ))}
</ul>
```

Replace with:

```tsx
<ul className="space-y-2">
  {selectedEvents.map((event) => (
    <li key={event.id}>
      <button
        type="button"
        onClick={() => openEvent(event)}
        className="flex w-full items-center gap-3 rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-3 text-left shadow-[var(--hh-shadow-card)]"
      >
        <span className="text-sm font-medium tabular-nums text-[var(--hh-muted)]">
          {event.allDay || !event.startsAt
            ? 'All day'
            : formatEventTime(event.startsAt, tz)}
        </span>
        <span className="flex-1 font-medium text-[var(--hh-ink)]">
          {event.title}
        </span>
        <span
          className="flex shrink-0 items-center gap-1.5 text-xs font-semibold"
          style={{ color: ownerColors.colorFor(event.ownerId) }}
        >
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: ownerColors.colorFor(event.ownerId) }}
          />
          {ownerColors.labelFor(event.ownerId)}
        </span>
      </button>
    </li>
  ))}
</ul>
```

Add near the top of the component (after the `household`/`events` hooks, e.g. right after `const events = useCalendarEvents(householdId)`):

```tsx
const { user } = useAuth()
const ownerColors = useMemo(
  () => buildOwnerColors(household.data?.members ?? [], user?.id ?? null),
  [household.data?.members, user?.id],
)
```

Add imports at the top of the file:

```tsx
import { buildOwnerColors } from '@household-hub/domain'
import { useAuth } from '@/hooks/useAuth'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/CalendarScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full web test suite + lint**

Run: `npm run test && npm run lint`
Expected: all green (398+ tests, no lint errors).

- [ ] **Step 6: Commit**

```bash
git add src/features/calendar/CalendarScreen.tsx src/test/CalendarScreen.test.tsx
git commit -m "feat(web): show event owner attribution on calendar event rows"
```

---

### Task 3: Calendar — mobile dot alignment, legend removal, event-row owner attribution

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`
- Test: `mobile/app/(tabs)/index.test.tsx` (create) — or, if this repo's mobile convention avoids testing route files directly, add the assertions to a new `mobile/src/features/calendar/ownerAttribution.test.ts` that exercises the same rendering logic factored out (see Step 3 below for exactly which helpers exist to test); check `mobile/src/features/calendar/*.test.ts` for the existing pattern before deciding — this repo already tests pure calendar logic there, not the route component, so prefer adding a small colocated pure helper if the route itself isn't unit-testable, rather than skipping coverage.

**Interfaces:**
- Consumes: `buildOwnerColors` from `@household-hub/domain` (Task 1), `useAuth()` from `@/lib/auth/AuthContext` (`session?.user.id`).

Root cause of the alignment bug (confirmed by reading `mobile/app/(tabs)/index.tsx:116-163,374-389`): the event dot is a normal-flow flex sibling of the day-number `View` inside `styles.cell` (`gap: 2, justifyContent: 'center'`), so a cell with an event has taller total content than one without, shifting the number up ~2-3px. Fix mirrors the web implementation (`CalendarScreen.tsx:160,177-185`), which already works correctly because its dot is `position: absolute`.

- [ ] **Step 1: Fix the dot alignment bug**

In `mobile/app/(tabs)/index.tsx`, change `styles.cell` and `styles.dot` (currently at lines 374-389):

```ts
// before
cell: {
  flex: 1,
  height: 38,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  borderRadius: 10,
},
...
dot: { width: 4, height: 4, borderRadius: 2 },
```

```ts
// after
cell: {
  flex: 1,
  height: 38,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 10,
},
...
dot: {
  position: 'absolute',
  bottom: 4,
  width: 4,
  height: 4,
  borderRadius: 2,
},
```

(`Pressable` renders a `View`-equivalent whose default `position` is `'relative'`, so the absolutely-positioned dot lays out relative to the cell exactly like the web `relative`/`absolute` pair at `CalendarScreen.tsx:160,180`. No other change needed in `renderCell` — the dot `View` at lines 153-160 already renders unconditionally sized correctly, only its containing flow changes.)

- [ ] **Step 2: Remove the legend and add per-event owner attribution**

Delete the legend block (currently lines 190-194):

```tsx
<View style={styles.legend}>
  <LegendItem color={tokens.ink} label="Yongju" tokens={tokens} />
  <LegendItem color={tokens.ink} label="Claire" outlineCircle tokens={tokens} />
  <LegendItem color={tokens.accent} label="Shared" tokens={tokens} />
</View>
```

Delete the now-unused `LegendItem` function (lines 295-319) and its styles (`legend`, `legendItem`, `legendDot`, `legendLabel` at lines 348-351).

Add the owner-colors hook near the top of the component, after `const eventList = useMemo(...)`:

```tsx
const { session } = useAuth()
const ownerColors = useMemo(
  () => buildOwnerColors(household.data?.members ?? [], session?.user.id ?? null),
  [household.data?.members, session?.user.id],
)
```

Add imports:

```tsx
import { buildOwnerColors } from '@household-hub/domain'
import { useAuth } from '@/lib/auth/AuthContext'
```

Replace the event row renderer (currently lines 262-275):

```tsx
renderItem={({ item }) => (
  <Pressable onPress={() => openEvent(item)} style={styles.eventRowWrap}>
    <Card style={styles.eventRow}>
      <Text style={[styles.eventTime, { color: tokens.muted }]}>
        {item.allDay || !item.startsAt
          ? 'All day'
          : formatEventTime(item.startsAt, tz)}
      </Text>
      <Text style={[styles.eventTitle, { color: tokens.ink }]}>
        {item.title}
      </Text>
    </Card>
  </Pressable>
)}
```

with:

```tsx
renderItem={({ item }) => (
  <Pressable onPress={() => openEvent(item)} style={styles.eventRowWrap}>
    <Card style={styles.eventRow}>
      <Text style={[styles.eventTime, { color: tokens.muted }]}>
        {item.allDay || !item.startsAt
          ? 'All day'
          : formatEventTime(item.startsAt, tz)}
      </Text>
      <Text style={[styles.eventTitle, { color: tokens.ink }]}>
        {item.title}
      </Text>
      <View style={styles.ownerBadge}>
        <View
          style={[styles.ownerDot, { backgroundColor: ownerColors.colorFor(item.ownerId) }]}
        />
        <Text style={[styles.ownerLabel, { color: ownerColors.colorFor(item.ownerId) }]}>
          {ownerColors.labelFor(item.ownerId)}
        </Text>
      </View>
    </Card>
  </Pressable>
)}
```

Add styles (near `eventTitle` in the `StyleSheet.create` block):

```ts
ownerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, shrink: 0 } as never,
ownerDot: { width: 6, height: 6, borderRadius: 3 },
ownerLabel: { fontSize: 11, fontWeight: '700' },
```

(Use `flexShrink: 0` not `shrink: 0` — RN's `StyleSheet` type is `flexShrink`; write `ownerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }`.)

- [ ] **Step 3: Add regression coverage**

Since `mobile/app/(tabs)/index.tsx` is a route file, check whether `mobile/` already has any `@testing-library/react-native` render test for a route file (e.g. search `mobile/app` for `.test.tsx`). If none exist and the mobile test convention is data/logic-only (matching what Task investigation found: `mobile/src/features/calendar/*.test.ts` only test `monthGrid.ts`/`events.ts` pure functions), add a unit test instead that exercises `buildOwnerColors` usage through a small extracted pure helper — but since `ownerColors.colorFor`/`labelFor` are already fully covered by Task 1's domain tests, and the JSX wiring here is a thin pass-through, it's acceptable to skip a new render test for this file specifically **only if** no existing precedent for testing `mobile/app/(tabs)/*.tsx` route files exists. Confirm this by running `find mobile/app -name '*.test.*'` before skipping — if it returns any file, follow that file's exact pattern instead of skipping.

- [ ] **Step 4: Run mobile tests + typecheck**

Run: `cd mobile && npm test && npx tsc --noEmit`
Expected: PASS, no new failures (100+ existing tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(tabs\)/index.tsx
git commit -m "fix(mobile): calendar dot alignment, remove legend, add per-event owner attribution"
```

---

### Task 4: Groceries — verify price history and autocomplete end-to-end

**Files:** none expected to change; investigation only, with a fallback fix path if a real bug is found.

Investigation already found that `cheapestPriceHistory()` (`src/features/groceries/data.ts:187-200`, `mobile/src/features/groceries/data.ts:188-201`) already implements exactly the resolved behavior — 5 cheapest ever, ascending by price, tie-broken by most-recent, with `recordedAt` retained for display — and both `GroceryListScreen.tsx` (web, lines 285-323) and `[listId].tsx` (mobile, lines 263-292) already render it under a "Five cheapest · {name}" heading, reachable by tapping an item row. Web tests (`src/test/GroceryListScreen.test.tsx`, `src/test/groceryData.test.ts`) and mobile tests (`mobile/src/features/groceries/data.test.ts`) already cover this, committed in `876d532` (2026-07-25, web) and `e842444` (2026-07-25, mobile) — both **before** the 2026-07-26 manual test that reported it missing. So this may already be resolved; confirm live before concluding no code change is needed.

- [ ] **Step 1: Run existing coverage**

Run: `npm run test -- groceryData GroceryListScreen` (web) and `cd mobile && npm test -- data.test` (mobile).
Expected: PASS. If either fails, that's your real bug — switch to `superpowers:systematic-debugging` on the specific failure instead of continuing this task's remaining steps.

- [ ] **Step 2: Live-verify on web**

Start the stack per `progress.md`'s "Local testing" section:

```bash
npx supabase start
npm run dev
```

Sign in as `yongju@test.local` / `household123`, open Groceries, create a list, add an item with a price, check it off (recording a purchase), repeat with a different price for the same item name, then tap the item row. Confirm the "Five cheapest · {name}" section appears with both prices, cheapest first, each with a date. Also type a partial name in the add-item field and confirm the autocomplete suggestion list appears.

- [ ] **Step 3: Live-verify on mobile**

Run the mobile app against the same local Supabase stack (per `progress.md`'s native testing notes — `mobile/.env.local` pointed at the Mac LAN address) and repeat the same manual sequence in the Groceries tab.

- [ ] **Step 4: Resolve findings**

- If both platforms show price history and autocomplete correctly: no code change needed. Update `progress.md`'s Groceries finding list to note it was verified working as of this pass (see Task 12).
- If either platform fails to show it: this contradicts the static code review, so treat it as a new, unreproduced-by-code-reading bug. Invoke `superpowers:systematic-debugging` — check for a runtime error in the console/logs first (e.g. an RLS or grants issue on `household_grocery_price_history`, per the `supabase-new-cli-no-default-dml-grants` memory note), form a hypothesis, and only then patch. Do not guess a fix without reproducing.

---

### Task 5: Ledger — expose a Statement-creation path from the "Statement not found" state

**Files:**
- Modify: `src/features/ledger/StatementMonthScreen.tsx`
- Modify: `mobile/app/(tabs)/ledger/[yearId].tsx`
- Test: `src/test/StatementMonthScreen.test.tsx` (extend existing file)

**Interfaces:** none new — `EmptyState` already supports an `action: ReactNode` prop (`src/shell/ui/states.tsx:13-29`, `mobile/src/components/states.tsx:21-40`).

Both `StatementsTab.tsx` (web and mobile) already expose a working "+ Year" button and an empty-state "Create year" action when zero years exist (`StatementsTab.tsx:24-58` web, mirrored mobile) — that surface is fine. The actual gap is narrower: the per-year detail screen's not-found branch (reached via a stale/bad `yearId`, e.g. after a year was deleted or from a broken link) renders a bare `EmptyState` with no way back to where a Statement can be created.

- [ ] **Step 1: Write the failing test**

Add to `src/test/StatementMonthScreen.test.tsx` (mirror however that file currently mocks `useParams`/`useLedgerYears` to produce a not-found case):

```tsx
it('offers a way back to the Ledger from the Statement-not-found state', () => {
  // render with a yearId that does not match any entry in useLedgerYears' data
  // assert a link/button with accessible name "Back to Ledger" is present
  // and that it points at (or navigates to) "/ledger"
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/StatementMonthScreen.test.tsx`
Expected: FAIL — no such link exists yet.

- [ ] **Step 3: Implement — web**

In `src/features/ledger/StatementMonthScreen.tsx`, replace the not-found branch (lines 70-76):

```tsx
if (!year || !query.data || !monthRow) {
  return (
    <Screen title="Ledger">
      <EmptyState title="Statement not found" />
    </Screen>
  )
}
```

with:

```tsx
if (!year || !query.data || !monthRow) {
  return (
    <Screen title="Ledger">
      <EmptyState
        title="Statement not found"
        hint="This year may have been removed, or the link is out of date."
        action={
          <Link
            to="/ledger"
            className="inline-flex items-center gap-1 rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Ledger
          </Link>
        }
      />
    </Screen>
  )
}
```

(`Link` is already imported at the top of the file, `EmptyState` too — no new imports.)

- [ ] **Step 4: Implement — mobile**

In `mobile/app/(tabs)/ledger/[yearId].tsx`, replace the not-found branch (lines 76-82):

```tsx
if (!year || !query.data || !monthRow) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]}>
      <EmptyState title="Statement not found" />
    </SafeAreaView>
  )
}
```

with:

```tsx
if (!year || !query.data || !monthRow) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]}>
      <EmptyState
        title="Statement not found"
        hint="This year may have been removed, or the link is out of date."
        action={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/ledger')}
            style={[styles.notFoundButton, { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl }]}
          >
            <Text style={[styles.notFoundButtonText, { color: tokens.accentContrast }]}>
              Back to Ledger
            </Text>
          </Pressable>
        }
      />
    </SafeAreaView>
  )
}
```

Add to the `StyleSheet.create` block in the same file:

```ts
notFoundButton: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
notFoundButtonText: { fontSize: 14, fontWeight: '700' },
```

(`router` is already destructured at the top of the component via `useRouter()`; `Pressable`/`Text` already imported.)

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/test/StatementMonthScreen.test.tsx && cd mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/ledger/StatementMonthScreen.tsx mobile/app/\(tabs\)/ledger/\[yearId\].tsx src/test/StatementMonthScreen.test.tsx
git commit -m "fix(ledger): add a way back to Ledger from the Statement-not-found state"
```

---

### Task 6: Ledger — replace manual year typing with a year list (disabled for existing years)

**Files:**
- Modify: `src/features/ledger/NewYearSheet.tsx`
- Modify: `mobile/src/features/ledger/NewYearSheet.tsx`
- Modify: `mobile/src/components/SelectField.tsx` (rebuild as tap-to-open dropdown, extend with per-option `disabled`)
- Test: `src/test/NewYearSheet.test.tsx` (create), `mobile/src/components/SelectField.test.tsx` (create)

**Interfaces:**
- Produces (`SelectField`): `SelectOption = { value: string; label: string; disabled?: boolean }`; component props unchanged (`{ label, value, options, onChange, disabled }`) — this is a pure internal rewrite, so none of `SelectField`'s 7+ existing call sites (`AssetSheet.tsx`, `TransferSheet.tsx`, `TransactionSheet.tsx`, `TripSheet.tsx`, `BookingSheet.tsx`, `ExpenseSheet.tsx`) need to change for this task; Task 11 is where their wheel-picker *behavior* is validated end-to-end.

Both `NewYearSheet.tsx` files are currently a raw 4-digit `TextInput`/`<input>` with a client-side "already exists" check as the only guard against duplicates. This task replaces the input with a selectable year list; years already in `years` (from `useLedgerYears`) show but can't be selected. The RPC's server-side 1900-9999 check constraint is untouched — this task cannot violate it, since the candidate list is always inside that range.

- [ ] **Step 1: Write the failing test — web**

Create `src/test/NewYearSheet.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NewYearSheet } from '@/features/ledger/NewYearSheet'
import type { LedgerYear } from '@/features/ledger/statements'

vi.mock('@/features/ledger/statementMutations', () => ({
  createYear: vi.fn().mockResolvedValue({ status: 'applied' }),
}))

const existingYears: LedgerYear[] = [
  { id: 'y1', year: 2026, revision: 1 } as LedgerYear,
]

describe('NewYearSheet', () => {
  it('shows existing years as visible but disabled, and lets an uncreated year be picked', () => {
    render(
      <NewYearSheet open onOpenChange={() => {}} householdId="hh1" years={existingYears} />,
    )
    const select = screen.getByLabelText('Year') as HTMLSelectElement
    const existingOption = Array.from(select.options).find((o) => o.value === '2026')
    expect(existingOption?.disabled).toBe(true)
    const openOption = Array.from(select.options).find((o) => o.value === '2027')
    expect(openOption?.disabled).toBe(false)
    fireEvent.change(select, { target: { value: '2027' } })
    expect(select.value).toBe('2027')
  })
})
```

(Adjust the `LedgerYear` mock shape and import paths to match this repo's exact type — check `src/features/ledger/statements.ts` for the real `LedgerYear` fields before finalizing; the test only needs `id`/`year` to exist.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/NewYearSheet.test.tsx`
Expected: FAIL — `getByLabelText('Year')` currently returns a text `<input>`, not a `<select>`.

- [ ] **Step 3: Implement — web**

Replace `src/features/ledger/NewYearSheet.tsx` in full:

```tsx
import { useMemo, useState } from 'react'
import { BottomSheet } from '@/shell/ui/BottomSheet'
import { operationOutcomeError } from '@/lib/operations/outcome'
import { createYear } from './statementMutations'
import type { LedgerYear } from './statements'

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'

function candidateYears(existing: number[]): number[] {
  const current = new Date().getFullYear()
  const range = Array.from({ length: 13 }, (_, i) => current + 2 - i)
  return Array.from(new Set([...range, ...existing])).sort((a, b) => b - a)
}

export function NewYearSheet({
  open,
  onOpenChange,
  householdId,
  years,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  years: LedgerYear[]
}) {
  const existingYears = useMemo(() => years.map((entry) => entry.year), [years])
  const options = useMemo(() => candidateYears(existingYears), [existingYears])
  const [value, setValue] = useState(() => String(options.find((y) => !existingYears.includes(y)) ?? options[0]))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const year = Number(value)
    if (!/^\d{4}$/.test(value) || year < 1900 || year > 9999) {
      setError('Enter a four-digit year.')
      return
    }
    if (existingYears.includes(year)) {
      setError(`${year} already exists.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await createYear(householdId, crypto.randomUUID(), year)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="New statement year">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-[var(--hh-muted)]" htmlFor="ledger-year">
          Year
        </label>
        <select
          id="ledger-year"
          className={field}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
        >
          {options.map((year) => (
            <option key={year} value={year} disabled={existingYears.includes(year)}>
              {year}
              {existingYears.includes(year) ? ' (already created)' : ''}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-[var(--hh-danger)]">{error}</p>}
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="w-full rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          Create year
        </button>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 4: Run web test to verify it passes**

Run: `npx vitest run src/test/NewYearSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing test — SelectField (mobile)**

Create `mobile/src/components/SelectField.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { SelectField } from './SelectField'

describe('SelectField', () => {
  const options = [
    { value: '2025', label: '2025', disabled: true },
    { value: '2026', label: '2026' },
  ]

  it('opens a menu on tap instead of showing an always-visible wheel, and skips disabled options', () => {
    const onChange = jest.fn()
    render(<SelectField label="Year" value="2026" options={options} onChange={onChange} />)

    // closed: no option rows visible yet
    expect(screen.queryByText('2025')).toBeNull()

    fireEvent.press(screen.getByLabelText('Year'))
    expect(screen.getByText('2026')).toBeTruthy()

    fireEvent.press(screen.getByText('2025'))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.press(screen.getByText('2026'))
    expect(onChange).toHaveBeenCalledWith('2026')
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd mobile && npx jest SelectField.test.tsx`
Expected: FAIL — current implementation renders an always-visible `Picker`, no tap-to-open behavior, no `disabled` support.

- [ ] **Step 7: Implement — SelectField rewrite**

Replace `mobile/src/components/SelectField.tsx` in full:

```tsx
import { useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'
import { CheckIcon, ChevronDownIcon } from './icons'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectFieldProps {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
}

/** Labeled tap-to-open dropdown field — the RN equivalent of a web `<select>`. */
export function SelectField({ label, value, options, onChange, disabled }: SelectFieldProps) {
  const { tokens } = useTheme()
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <View>
      <Text style={[styles.label, { color: tokens.muted }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          { borderColor: tokens.line, borderRadius: tokens.radiusControl },
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.value, { color: tokens.ink }]} numberOfLines={1}>
          {selected?.label ?? 'Select…'}
        </Text>
        <ChevronDownIcon size={16} color={tokens.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: tokens.card }, tokens.shadowFloat]}>
            <Text style={[styles.menuTitle, { color: tokens.muted }]}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(option) => option.value}
              style={styles.menuList}
              renderItem={({ item }) => {
                const active = item.value === value
                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={item.disabled}
                    onPress={() => {
                      onChange(item.value)
                      setOpen(false)
                    }}
                    style={[styles.menuItem, item.disabled && styles.disabled]}
                  >
                    <Text
                      style={[styles.menuItemText, { color: active ? tokens.accent : tokens.ink }]}
                    >
                      {item.label}
                    </Text>
                    {active ? <CheckIcon size={16} color={tokens.accent} /> : null}
                  </Pressable>
                )
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  disabled: { opacity: 0.6 },
  value: { fontSize: 15, flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  menu: { width: '100%', maxWidth: 360, maxHeight: '60%', borderRadius: 16, padding: 8 },
  menuTitle: { fontSize: 12.5, fontWeight: '600', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  menuList: { maxHeight: 320 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  menuItemText: { fontSize: 15, flex: 1 },
})
```

Remove the `@react-native-picker/picker` dependency from `mobile/package.json` once this is the only usage (check `grep -rn "@react-native-picker/picker" mobile/src mobile/app` returns only this file before removing it from `package.json`/running `npm install` inside `mobile/`).

- [ ] **Step 8: Run test to verify it passes**

Run: `cd mobile && npx jest SelectField.test.tsx`
Expected: PASS.

- [ ] **Step 9: Implement — mobile NewYearSheet**

Replace `mobile/src/features/ledger/NewYearSheet.tsx` in full:

```tsx
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { SelectField } from '@/components/SelectField'
import { operationOutcomeError } from '@/lib/operations'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'
import { createYear } from './statementMutations'
import type { LedgerYear } from './statements'

function candidateYears(existing: number[]): number[] {
  const current = new Date().getFullYear()
  const range = Array.from({ length: 13 }, (_, i) => current + 2 - i)
  return Array.from(new Set([...range, ...existing])).sort((a, b) => b - a)
}

export function NewYearSheet({
  open,
  onOpenChange,
  householdId,
  years,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  years: LedgerYear[]
}) {
  const { tokens } = useTheme()
  const existingYears = useMemo(() => years.map((entry) => entry.year), [years])
  const options = useMemo(
    () =>
      candidateYears(existingYears).map((year) => ({
        value: String(year),
        label: existingYears.includes(year) ? `${year} (already created)` : String(year),
        disabled: existingYears.includes(year),
      })),
    [existingYears],
  )
  const [value, setValue] = useState(
    () => options.find((option) => !option.disabled)?.value ?? options[0]?.value ?? '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const year = Number(value)
    if (!/^\d{4}$/.test(value) || year < 1900 || year > 9999) {
      setError('Enter a four-digit year.')
      return
    }
    if (existingYears.includes(year)) {
      setError(`${year} already exists.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const outcome = await createYear(householdId, newUuid(), year)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="New statement year">
      <SelectField label="Year" value={value} options={options} onChange={setValue} />
      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={() => void handleSave()}
        style={[
          styles.button,
          { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl },
          saving && styles.disabled,
        ]}
      >
        <Text style={[styles.buttonText, { color: tokens.accentContrast }]}>Create year</Text>
      </Pressable>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  error: { fontSize: 13, marginTop: 8, marginBottom: 10 },
  button: { paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
})
```

- [ ] **Step 10: Run mobile tests + typecheck**

Run: `cd mobile && npm test && npx tsc --noEmit`
Expected: PASS, including every existing `SelectField` consumer's tests (`AssetSheet`, `TransferSheet`, `TransactionSheet`, `TripSheet`, `BookingSheet`, `ExpenseSheet` — their tests interact via `label`/`value`/`onChange`, which is unchanged).

- [ ] **Step 11: Commit**

```bash
git add src/features/ledger/NewYearSheet.tsx mobile/src/features/ledger/NewYearSheet.tsx \
  mobile/src/components/SelectField.tsx src/test/NewYearSheet.test.tsx \
  mobile/src/components/SelectField.test.tsx mobile/package.json mobile/package-lock.json
git commit -m "feat(ledger): replace manual year entry with a disabled-aware year list"
```

---

### Task 7: Ledger — remove monthly budget-limit chart from the annual Statement view

**Files:**
- Modify: `src/features/ledger/StatementYearSummary.tsx`
- Modify: `src/features/ledger/StatementCharts.tsx`
- Modify: `src/features/ledger/statements.ts` (delete now-dead `monthlyBudgetLimits`)
- Modify: `src/test/ledgerStatements.test.ts` (delete its `monthlyBudgetLimits` test)
- Mirror all of the above under `mobile/src/features/ledger/`
- Modify: `mobile/src/features/ledger/statements.test.ts` (delete its `monthlyBudgetLimits` test)

Investigation found the "Monthly budget limits" 12-bar chart (`StatementCharts.tsx:100-131`) is **only** reachable today from the annual view (`StatementYearSummary.tsx:22` passes `showMonthlyLimits`) — the per-month view (`StatementMonthScreen.tsx:126`) never passes that prop, so it's already correctly absent there. The finding wants the chart gone from the annual view entirely (monthly limits belong in the per-category rows on the month screen, which already exist and are untouched by this task) — so after this change, `showMonthlyLimits` has zero remaining call sites and should be deleted outright rather than left as dead code, per this repo's "if you're certain it's unused, delete it completely" convention.

- [ ] **Step 1: Remove the prop and JSX block — web `StatementCharts.tsx`**

Change the function signature (lines 20-28):

```tsx
// before
export function StatementCharts({
  data,
  monthId,
  showMonthlyLimits = false,
}: {
  data: LedgerYearData
  monthId?: string
  showMonthlyLimits?: boolean
}) {
  const totals = statementTotals(data, monthId)
  const categories = spendingCategoryTotals(data, monthId)
  const limits = monthlyBudgetLimits(data)
  const maxLimit = Math.max(...limits.map((entry) => entry.limitCents), 1)
```

```tsx
// after
export function StatementCharts({
  data,
  monthId,
}: {
  data: LedgerYearData
  monthId?: string
}) {
  const totals = statementTotals(data, monthId)
  const categories = spendingCategoryTotals(data, monthId)
```

Delete the `monthlyBudgetLimits` import (line 12 of the `import { ... } from './statements'` block) and the entire `{showMonthlyLimits && (...)}` block (lines 100-131).

- [ ] **Step 2: Update the call site — web `StatementYearSummary.tsx`**

Change line 22 from `<StatementCharts data={query.data} showMonthlyLimits />` to `<StatementCharts data={query.data} />`.

- [ ] **Step 3: Delete the now-dead pure function — web `statements.ts`**

Remove `monthlyBudgetLimits` (currently at `src/features/ledger/statements.ts:357` — read the function's full extent before deleting to remove it cleanly, including its JSDoc if any).

- [ ] **Step 4: Delete its test — web `src/test/ledgerStatements.test.ts`**

Remove the `monthlyBudgetLimits` import and the test block that calls it (currently around line 148 — read the surrounding `describe`/`it` block to remove it cleanly without leaving a dangling `describe`).

- [ ] **Step 5: Repeat Steps 1-4 for mobile**

Apply the identical changes to:
- `mobile/src/features/ledger/StatementCharts.tsx` (same line numbers as web: signature at 20ish, JSX block ~70-97 per investigation — read current file first, mobile line numbers may differ slightly from web's)
- `mobile/src/features/ledger/StatementYearSummary.tsx` (same `showMonthlyLimits` prop removal)
- `mobile/src/features/ledger/statements.ts:357` (delete `monthlyBudgetLimits`)
- `mobile/src/features/ledger/statements.test.ts:147` (delete its test)

- [ ] **Step 6: Run tests + typecheck**

Run: `npm run test && npm run lint && cd mobile && npm test && npx tsc --noEmit`
Expected: PASS. No references to `monthlyBudgetLimits` or `showMonthlyLimits` remain (`grep -rn "monthlyBudgetLimits\|showMonthlyLimits" src mobile/src mobile/app` returns nothing).

- [ ] **Step 7: Commit**

```bash
git add src/features/ledger/StatementCharts.tsx src/features/ledger/StatementYearSummary.tsx \
  src/features/ledger/statements.ts src/test/ledgerStatements.test.ts \
  mobile/src/features/ledger/StatementCharts.tsx mobile/src/features/ledger/StatementYearSummary.tsx \
  mobile/src/features/ledger/statements.ts mobile/src/features/ledger/statements.test.ts
git commit -m "fix(ledger): scope monthly budget limits to the month view, drop from the annual summary"
```

---

### Task 8: Notes — fix "Could not load this note." for notes not yet synced to the server

**Files:**
- Modify: `src/features/notes/data.ts`
- Modify: `mobile/src/features/notes/data.ts`
- Test: `src/test/notesData.test.ts` (extend existing file)

**Interfaces:**
- `useNote`'s return type changes from `Note` to `Note | null` — this is source-compatible with every current caller: `NoteScreen.tsx:36` and mobile `[noteId].tsx`'s equivalent already guard with `if (query.isError || !query.data)` before touching `query.data.document`, so no caller-side change is needed.

**Root cause** (confirmed by reading `data.ts:53-69` in both platforms): `useNote` fetches with `.single()`, which throws whenever zero rows match. A brand-new note created client-side sits in the offline outbox until its `note.upsert` operation syncs — during that window there is no server row yet, `.single()` throws, `query.isError` becomes `true`, and the screen shows "Could not load this note." even though the note exists locally and should render from the optimistic overlay. `withOptimisticOverlay` (`src/lib/operations/overlay.ts:56-62`) is only reached *after* the fetch, so it never gets a chance to reconstruct the pending note. Every other single-entity fetch in this codebase (`src/features/trips/data.ts:120-125`'s `useTrip`) already uses `.maybeSingle()` + explicit `null` handling for exactly this reason — Notes is the only detail query still on `.single()`.

- [ ] **Step 1: Write the failing test**

Add to `src/test/notesData.test.ts` (check its existing mocking pattern for `supabase.from(...).select(...).eq(...)` and the queue/overlay, mirror it):

```ts
it('reconstructs a note from the optimistic overlay when it has no server row yet', async () => {
  // mock supabase so .maybeSingle() resolves { data: null, error: null }
  // seed the operation queue (db.operations) with a queued note.upsert
  // operation for this noteId carrying { title, document, revision: 0 }
  // call useNote's queryFn (or render a hook-test wrapper) and assert
  // the result is the reconstructed Note, not a thrown error
})
```

(Match this file's existing style exactly — check how it currently seeds `db.operations` for other cases, e.g. for `useNotes`' list-level overlay test if one exists, and reuse that helper.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/notesData.test.ts`
Expected: FAIL — current `.single()` throws before the overlay runs.

- [ ] **Step 3: Implement — web**

In `src/features/notes/data.ts`, replace `useNote` (lines 47-69):

```ts
// before
export function useNote(householdId: string | undefined, noteId: string | undefined) {
  return useQuery({
    queryKey:
      householdId && noteId ? queryKeys.notes.note(householdId, noteId) : ['notes', 'note', 'off'],
    enabled: !!householdId && !!noteId,
    queryFn: async (): Promise<Note> => {
      const { data, error } = await supabase
        .from('household_notes')
        .select('id, title, document, revision')
        .eq('id', noteId!)
        .single<Pick<Tables<'household_notes'>, 'id' | 'title' | 'document' | 'revision'>>()
      if (error) throw error
      const [note] = await withOptimisticOverlay([{
        id: data.id,
        title: data.title,
        document: data.document as unknown as RichNoteDocument,
        revision: data.revision,
      }], 'note')
      return note
    },
  })
}
```

```ts
// after
export function useNote(householdId: string | undefined, noteId: string | undefined) {
  return useQuery({
    queryKey:
      householdId && noteId ? queryKeys.notes.note(householdId, noteId) : ['notes', 'note', 'off'],
    enabled: !!householdId && !!noteId,
    queryFn: async (): Promise<Note | null> => {
      const { data, error } = await supabase
        .from('household_notes')
        .select('id, title, document, revision')
        .eq('id', noteId!)
        .maybeSingle<Pick<Tables<'household_notes'>, 'id' | 'title' | 'document' | 'revision'>>()
      if (error) throw error
      const rows = data
        ? [{
            id: data.id,
            title: data.title,
            document: data.document as unknown as RichNoteDocument,
            revision: data.revision,
          }]
        : []
      const [note] = await withOptimisticOverlay(rows, 'note')
      return note ?? null
    },
  })
}
```

- [ ] **Step 4: Implement — mobile**

Apply the identical change to `mobile/src/features/notes/data.ts` (byte-identical file per investigation — same before/after).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/notesData.test.ts`
Expected: PASS.

- [ ] **Step 6: Manually verify the original repro**

Per `progress.md`'s findings: "verify existing saved JSON, empty notes, headings, bullets, numbered lists, and checklists load safely." Using the local dev stack (`npx supabase start && npm run dev`, login per `progress.md`'s test credentials): create a new note (title + a heading, a bulleted list, a numbered list, and a checklist item via the restricted TenTap toolbar), save it, then navigate away and back into it from the Notes list — confirm it opens in read mode without the error, rendering each block type correctly. Also open an existing note with no edits (empty document) and confirm it loads.

- [ ] **Step 7: Run full suites**

Run: `npm run test && npm run lint && npm run build && cd mobile && npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/features/notes/data.ts mobile/src/features/notes/data.ts src/test/notesData.test.ts
git commit -m "fix(notes): use maybeSingle so a not-yet-synced note reads from the optimistic overlay instead of erroring"
```

---

### Task 9: Mobile layout — dock the tab bar flush to the bottom edge

**Files:**
- Modify: `mobile/src/components/FloatingTabBar.tsx`
- Modify: `mobile/app/(tabs)/index.tsx` (padding only)
- Modify: `mobile/app/(tabs)/ledger/index.tsx` (padding only)
- Modify: `mobile/app/(tabs)/ledger/[yearId].tsx` (padding only)
- Modify: `mobile/app/(tabs)/notes/index.tsx` (padding only)
- Modify: `mobile/app/(tabs)/groceries/index.tsx` (padding only)
- Modify: `mobile/app/(tabs)/groceries/[listId].tsx` (padding only)
- Modify: `mobile/app/(tabs)/trips/index.tsx` (padding only)
- Modify: `mobile/app/(tabs)/trips/[tripId].tsx` (padding only)

Currently `FloatingTabBar` is `position: 'absolute'`, floats `Math.max(8, insets.bottom + 4)` above the bottom edge as a rounded pill (`FloatingTabBar.tsx:41-54,96-105`), and every screen compensates with a hardcoded `paddingBottom: 120` so content doesn't render underneath it. This task docks the bar as a normal flex sibling (it's already the last child of the `root` column in `mobile/app/(tabs)/_layout.tsx:24`, so removing `position: 'absolute'` alone makes it lay out in-flow, flush with the bottom safe area) and shrinks the compensating padding back down now that nothing overlaps it.

- [ ] **Step 1: Dock the tab bar**

Replace `mobile/src/components/FloatingTabBar.tsx` in full:

```tsx
import { useRouter, usePathname } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme, type ThemeTokens } from '@/theme/tokens'
import {
  CalendarIcon,
  GroceriesIcon,
  LedgerIcon,
  NotesIcon,
  TripsIcon,
  type IconProps,
} from './icons'

export interface Destination {
  path: '/' | '/groceries' | '/ledger' | '/notes' | '/trips'
  label: string
  icon: (props: IconProps) => React.JSX.Element
}

export const TAB_DESTINATIONS: Destination[] = [
  { path: '/', label: 'Schedule', icon: CalendarIcon },
  { path: '/groceries', label: 'Groceries', icon: GroceriesIcon },
  { path: '/ledger', label: 'Ledger', icon: LedgerIcon },
  { path: '/notes', label: 'Notes', icon: NotesIcon },
  { path: '/trips', label: 'Trips', icon: TripsIcon },
]

export function tabActiveForPath(path: Destination['path'], pathname: string): boolean {
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * Bottom tab bar, docked flush with the bottom safe area (not floating) so
 * screens recover the vertical space a hovering pill used to cost them.
 */
export function FloatingTabBar() {
  const { tokens } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: tokens.card, paddingBottom: insets.bottom + 6 },
        tokens.shadowFloat,
      ]}
    >
      {TAB_DESTINATIONS.map(({ path, label, icon: Icon }) => {
        const active = tabActiveForPath(path, pathname)
        return (
          <Pressable
            key={path}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => router.replace(path)}
            style={[
              styles.item,
              active && { backgroundColor: tokens.accentSoft },
            ]}
          >
            <Icon
              size={20}
              color={active ? tokens.accent : tokens.muted}
              strokeWidth={active ? 2 : 1.5}
            />
            <Text style={itemLabelStyle(tokens, active)}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
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
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 12,
  },
})
```

(Exported `TAB_DESTINATIONS` and `tabActiveForPath` so Task 10's `AppHeader` can reuse the same path→label map instead of duplicating it — DRY, and guarantees the header title and the active tab always agree.)

- [ ] **Step 2: Shrink the compensating bottom padding on every screen**

The tab bar no longer overlays content, so `paddingBottom: 120` is now dead space. In each of the 8 files listed above, change the `paddingBottom: 120` found in that screen's outermost `StyleSheet.create` entry (`listContent` or `content`, per the earlier `grep`) to `paddingBottom: 24` (matching the existing `padding: 20` top/side value with a little extra clearance) — e.g. in `mobile/app/(tabs)/index.tsx:333`:

```ts
// before
listContent: { padding: 20, paddingBottom: 120 },
// after
listContent: { padding: 20, paddingBottom: 24 },
```

Apply the same `120 → 24` edit at:
- `mobile/app/(tabs)/ledger/index.tsx:58` (`content`)
- `mobile/app/(tabs)/ledger/[yearId].tsx:322` (`content`)
- `mobile/app/(tabs)/notes/index.tsx:118` (`listContent`, keep `flexGrow: 1`)
- `mobile/app/(tabs)/groceries/index.tsx:124` (`listContent`, keep `flexGrow: 1`)
- `mobile/app/(tabs)/groceries/[listId].tsx:404` (`listContent`)
- `mobile/app/(tabs)/trips/index.tsx:93` (`listContent`, keep `flexGrow: 1`)
- `mobile/app/(tabs)/trips/[tripId].tsx:709` (`content`)

(Line numbers are as of this investigation — re-read each file immediately before editing, since earlier tasks in this plan touch some of these same files and may have shifted lines.)

- [ ] **Step 3: Manual verification**

Run the app in the iOS Simulator or Android emulator (per `progress.md`'s EAS/local build notes) and confirm: the tab bar sits flush with the bottom safe area (no visible gap/floating pill), the active tab is still clearly highlighted, and scrolling to the bottom of each of the 5 tabs shows the last item/card fully clear of the tab bar with no excess empty space below it.

- [ ] **Step 4: Run mobile tests + typecheck**

Run: `cd mobile && npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/FloatingTabBar.tsx mobile/app/\(tabs\)/index.tsx \
  mobile/app/\(tabs\)/ledger/index.tsx mobile/app/\(tabs\)/ledger/\[yearId\].tsx \
  mobile/app/\(tabs\)/notes/index.tsx mobile/app/\(tabs\)/groceries/index.tsx \
  mobile/app/\(tabs\)/groceries/\[listId\].tsx mobile/app/\(tabs\)/trips/index.tsx \
  mobile/app/\(tabs\)/trips/\[tripId\].tsx
git commit -m "fix(mobile): dock the tab bar flush with the bottom safe area, recover the freed content space"
```

---

### Task 10: Mobile layout — header shows the current page title, remove duplicate per-screen titles

**Files:**
- Modify: `mobile/src/components/AppHeader.tsx`
- Modify: `mobile/app/(tabs)/index.tsx` (remove `pageTitle` Text only)
- Modify: `mobile/app/(tabs)/ledger/index.tsx` (remove `pageTitle` Text only)
- Modify: `mobile/app/(tabs)/notes/index.tsx` (remove `pageTitle` Text only)
- Modify: `mobile/app/(tabs)/groceries/index.tsx` (remove `pageTitle` Text only)
- Modify: `mobile/app/(tabs)/trips/index.tsx` (remove `pageTitle` Text only)

`AppHeader` currently renders a fixed "🐰&🐧" wordmark, by its own doc comment intentionally leaving page titles to each screen (`AppHeader.tsx:8-13`). That's the duplication the finding calls out: every one of the 5 tab-root screens renders its own large `pageTitle` `<Text accessibilityRole="header">` (confirmed at `index.tsx:174-178`, `ledger/index.tsx:30-32`, `notes/index.tsx:51-53`, `groceries/index.tsx:58-60`, `trips/index.tsx:45-47`). This task makes the header show the active tab's title (reusing `TAB_DESTINATIONS`/`tabActiveForPath` from Task 9 so the label always matches the tab bar) and removes the now-redundant per-screen titles.

- [ ] **Step 1: Implement the route-aware header**

Replace `mobile/src/components/AppHeader.tsx` in full:

```tsx
import { usePathname, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/theme/tokens'
import { TAB_DESTINATIONS, tabActiveForPath } from './FloatingTabBar'
import { BellIcon, CogIcon } from './icons'

function titleForPath(pathname: string): string {
  const match = TAB_DESTINATIONS.find((destination) => tabActiveForPath(destination.path, pathname))
  return match?.label ?? 'Household Hub'
}

/**
 * Persistent header shown on every primary destination: the current page's
 * title top-left (matching the active tab), bell (notifications) + gear
 * (settings) as floating circular buttons top-right.
 */
export function AppHeader() {
  const { tokens } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.row,
        { paddingTop: insets.top + 6, backgroundColor: tokens.canvas },
      ]}
    >
      <Text accessibilityRole="header" style={[styles.title, { color: tokens.ink }]}>
        {titleForPath(pathname)}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => router.push('/notifications')}
          style={[
            styles.iconButton,
            { backgroundColor: tokens.card },
            tokens.shadowCard,
          ]}
        >
          <BellIcon size={18} color={tokens.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={[
            styles.iconButton,
            { backgroundColor: tokens.card },
            tokens.shadowCard,
          ]}
        >
          <CogIcon size={18} color={tokens.muted} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2 },
  actions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
```

- [ ] **Step 2: Remove each screen's duplicate title**

In each of the 5 files, delete just the `<Text accessibilityRole="header" style={[styles.pageTitle, ...]}>…</Text>` block and re-flow its `titleRow` so the remaining action button (if any) is right-aligned. Example for `mobile/app/(tabs)/groceries/index.tsx` (lines 58-67):

```tsx
// before
<View style={styles.titleRow}>
  <Text accessibilityRole="header" style={[styles.pageTitle, { color: tokens.ink }]}>
    Groceries
  </Text>
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="New list"
    onPress={() => setAdding(true)}
    style={[styles.addButton, { backgroundColor: tokens.accent }]}
  >
    <PlusIcon size={18} color={tokens.accentContrast} />
  </Pressable>
</View>
```

```tsx
// after
<View style={styles.titleRow}>
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="New list"
    onPress={() => setAdding(true)}
    style={[styles.addButton, { backgroundColor: tokens.accent }]}
  >
    <PlusIcon size={18} color={tokens.accentContrast} />
  </Pressable>
</View>
```

and change that file's `titleRow` style from `justifyContent: 'space-between'` to `justifyContent: 'flex-end'`.

Apply the same "delete the `pageTitle` Text, change its row's `justifyContent` to `flex-end`" edit at:
- `mobile/app/(tabs)/index.tsx` (`titleRow`, lines 173-188 — keep the "New event" `Pressable`)
- `mobile/app/(tabs)/ledger/index.tsx` (read the file first: if its title row has no companion button, remove the whole row/`View` wrapper, not just the `Text`, so no empty row remains)
- `mobile/app/(tabs)/notes/index.tsx` (`titleRow`, lines 51-53 area — check for a companion "+" button)
- `mobile/app/(tabs)/trips/index.tsx` (`titleRow`, lines 45-47 area — check for a companion "+" button)

Delete each screen's now-unused `pageTitle` style entry from its `StyleSheet.create` block.

- [ ] **Step 3: Manual verification**

Run the app and confirm: each of the 5 tabs shows exactly one title ("Schedule", "Groceries", "Ledger", "Notes", "Trips") in the header's upper-left, matching the active tab bar label; Notifications and Settings icons remain upper-right; no screen shows two titles.

- [ ] **Step 4: Run mobile tests + typecheck**

Run: `cd mobile && npm test && npx tsc --noEmit`
Expected: PASS. If any existing test asserts on the old wordmark ("🐰&🐧") or a `pageTitle` accessible name, update that assertion to the new title text.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/AppHeader.tsx mobile/app/\(tabs\)/index.tsx \
  mobile/app/\(tabs\)/ledger/index.tsx mobile/app/\(tabs\)/notes/index.tsx \
  mobile/app/\(tabs\)/groceries/index.tsx mobile/app/\(tabs\)/trips/index.tsx
git commit -m "fix(mobile): header shows the current page title, drop duplicate per-screen titles"
```

---

### Task 11: Mobile forms — compact the DateTimeField wheel/inline picker

**Files:**
- Modify: `mobile/src/components/DateTimeField.tsx`

`SelectField` (Task 6) already covers every dropdown-style picker. The other always-visible control the investigation found is `DateTimeField.tsx:48-59`, which sets `display: Platform.OS === 'ios' ? 'inline' : 'default'` — iOS's `'inline'` mode renders an always-expanded calendar/spinner inline (the vertical-space offender across `EventSheet`, `TransactionSheet`, `TransferSheet`, `TripSheet`, `BookingSheet`, `ExpenseSheet`, `ItinerarySheet`). Android's `'default'` already opens as a modal dialog on tap and needs no change. Switching iOS to `'compact'` mode gives the same tap-to-open behavior on both platforms: a small pill showing the current value that expands a popover only when tapped.

- [ ] **Step 1: Read the current file**

Read `mobile/src/components/DateTimeField.tsx` in full to get its exact current props/JSX before editing (it wasn't fully read during investigation — only the `display` line was confirmed).

- [ ] **Step 2: Change the iOS display mode**

Change the `display` prop passed to `@react-native-community/datetimepicker`'s `<DateTimePicker>` from:

```ts
display: Platform.OS === 'ios' ? 'inline' : 'default'
```

to:

```ts
display: Platform.OS === 'ios' ? 'compact' : 'default'
```

If the surrounding code renders the picker unconditionally inline (rather than behind its own tap-to-reveal state) because `'inline'` mode was assumed to always be visible, check whether `'compact'` mode's popover needs an anchoring container change — `@react-native-community/datetimepicker`'s `'compact'` mode on iOS renders its own small tappable pill and manages its own popover positioning, so no extra state should be needed, but confirm this against the installed version's docs (`mobile/package.json` pins `9.1.0` — check `node_modules/@react-native-community/datetimepicker/README.md` or https://github.com/react-native-datetimepicker/datetimepicker for that version's `compact` mode support before finalizing, since `compact` requires iOS 14+ and this project's `mobile/AGENTS.md` warns that Expo/RN APIs may have moved — re-verify rather than assuming).

- [ ] **Step 3: Manual verification**

Run the app on iOS (Simulator, since that's what `progress.md` confirms is set up) and open a form using `DateTimeField` (e.g. the Calendar `EventSheet`'s start-date field). Confirm it now shows as a compact tappable value (not an always-expanded calendar) and that tapping it opens a popover to change the date/time, with the selected value clearly visible when closed.

- [ ] **Step 4: Run mobile tests + typecheck**

Run: `cd mobile && npm test && npx tsc --noEmit`
Expected: PASS. If any existing test drives `DateTimeField` by assuming the inline calendar is always rendered, update it to open the compact control first.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/DateTimeField.tsx
git commit -m "fix(mobile): switch DateTimeField to iOS compact mode, matching the tap-to-open pattern"
```

---

### Task 12: Close out the correction pass in `progress.md`

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: Update the status table and findings section**

Change the "Manual-test correction pass" row from "Pending" to "Complete", record the outcome of Task 4's Groceries verification (either "already correct, verified 2026-07-2X" or a note about what was actually fixed if Step 4 of Task 4 found a real bug), and remove or check off each finding under "Next correction pass — manual-test findings" so the file accurately reflects the new baseline before Task 9 starts.

- [ ] **Step 2: Commit**

```bash
git add progress.md
git commit -m "docs: close out the manual-test correction pass"
```

---

## After this plan

Once all 12 tasks are committed and every suite is green, `progress.md`'s Task 9 boundary is satisfied (per the user's standing approval: "You have my approval to move to Task 9 if the manual-test findings are all fixed"). Task 9 itself (physical-device testing, production Supabase/Vercel/EAS config, TestFlight signing, production reset) is out of scope for this plan and needs its own planning pass — most of its items are manual/infra work, not code changes, and several require the user directly (physical-device OAuth, App Store Connect access, production approval for the data reset).
