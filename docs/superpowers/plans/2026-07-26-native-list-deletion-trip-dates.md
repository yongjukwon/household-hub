# Native list radius, Statement deletion, and Trip dates implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every native list row use the Ledger segmented-control radius, make Statement deletion work immediately for new and legacy queued commands, and replace separate Trip dates with one range calendar.

**Architecture:** A focused `ListCard` component centralizes collection-row geometry without changing summary cards. Statement clear commands become true optimistic deletions, with an overlay compatibility rule for already-persisted malformed commands. A pure civil-date range module drives a dependency-free modal range calendar consumed only by `TripSheet`.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19.2.3, Expo Router, TypeScript, TanStack Query, SQLite durable operations, Jest, React Native Testing Library.

## Global constraints

- Work only in `/Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first`.
- Preserve all existing unrelated modified and untracked files.
- Do not change database schema, RPC contracts, web behavior, authentication, deployment, or production data.
- Use `tokens.radiusControl` for tappable list cards and retain `tokens.radiusCard` for summaries, forms, and modal surfaces.
- Keep strict revision validation and typed-year confirmation.
- Repair already-persisted `ledger.year.clear` commands without deleting the durable queue.
- Trip dates remain civil `YYYY-MM-DD` values and never convert through UTC.
- Add no calendar dependency.

---

### Task 1: Repair Statement deletion projection

**Files:**
- Create: `mobile/src/features/ledger/statementMutations.test.ts`
- Modify: `mobile/src/features/ledger/statementMutations.ts`
- Modify: `mobile/src/lib/operations/queue.test.ts`
- Modify: `mobile/src/lib/operations/overlay.ts`

**Interfaces:**
- Consumes: `enqueueOperation(input: EnqueueInput): Promise<EnqueueOutcome>`
- Produces: `clearYear()` with `optimistic: null`; `applyOptimisticOverlay()` treating `ledger.year.clear` as destructive regardless of legacy optimistic payload.

- [ ] **Step 1: Add a failing command-contract test**

Mock only the queue boundary, call `clearYear()`, and assert the real mutation
builder passes:

```ts
expect(enqueueOperation).toHaveBeenCalledWith(
  expect.objectContaining({
    type: 'ledger.year.clear',
    entityType: 'ledger_year',
    entityId: YEAR_ID,
    baseRevision: 3,
    payload: { year: 2026, confirmation: '2026' },
    optimistic: null,
  }),
)
```

- [ ] **Step 2: Add a failing legacy-overlay test**

Create a queued `ledger.year.clear` fixture whose `optimistic` value is the
old `{ year: 2026, confirmation: '2026' }` shape. Assert:

```ts
expect(
  applyOptimisticOverlay([YEAR_ROW], [LEGACY_CLEAR], 'ledger_year'),
).toEqual([])
```

Keep the existing upsert overlay assertion to prove non-destructive commands
still merge normally.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
npm --prefix mobile test -- --runInBand \
  src/features/ledger/statementMutations.test.ts \
  src/lib/operations/queue.test.ts
```

Expected: both new assertions fail because `clearYear()` supplies a non-null
optimistic payload and the generic overlay retains the year.

- [ ] **Step 4: Implement the minimal deletion repair**

Change `clearYear()` to:

```ts
optimistic: null,
```

Before the generic optimistic-null check, detect the legacy command:

```ts
const destructive =
  operation.optimistic === null ||
  operation.command.type === 'ledger.year.clear'
if (destructive) {
  merged.delete(operation.entityId)
  continue
}
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the same focused command. Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/features/ledger/statementMutations.ts \
  mobile/src/features/ledger/statementMutations.test.ts \
  mobile/src/lib/operations/overlay.ts \
  mobile/src/lib/operations/queue.test.ts
git commit -m "fix(mobile): remove cleared statements optimistically"
```

---

### Task 2: Introduce and apply the shared list-card radius

**Files:**
- Create: `mobile/src/components/ListCard.tsx`
- Create: `mobile/src/components/ListCard.test.tsx`
- Modify: `mobile/src/components/DetailListRow.tsx`
- Modify: `mobile/app/notifications.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`
- Modify: `mobile/app/(tabs)/groceries/[listId].tsx`
- Modify: `mobile/app/(tabs)/ledger/[yearId].tsx`
- Modify: `mobile/src/features/ledger/TransactionList.tsx`
- Modify: `mobile/src/features/ledger/AssetsTab.tsx`
- Modify: `mobile/app/(tabs)/trips/[tripId].tsx`

**Interfaces:**
- Produces:

```ts
export function ListCard(props: {
  children?: ReactNode
  style?: ViewStyle | ViewStyle[]
}): ReactElement
```

- Consumes: `Card` and `useTheme()`.

- [ ] **Step 1: Write the failing shared-surface test**

Render `ListCard`, flatten the rendered View style, and assert:

```ts
expect(style.borderRadius).toBe(lightTokens.radiusControl)
```

Also render `DetailListRow` and assert its outer surface resolves to the same
radius while navigation and deletion remain independent.

- [ ] **Step 2: Run the component tests and verify RED**

Run:

```bash
npm --prefix mobile test -- --runInBand \
  src/components/ListCard.test.tsx \
  src/components/DetailListRow.test.tsx
```

Expected: `ListCard` is missing and `DetailListRow` still inherits
`radiusCard`.

- [ ] **Step 3: Implement `ListCard` and migrate `DetailListRow`**

Implement:

```tsx
export function ListCard({ children, style }: ListCardProps) {
  const { tokens } = useTheme()
  return (
    <Card style={[{ borderRadius: tokens.radiusControl }, style]}>
      {children}
    </Card>
  )
}
```

Replace the outer `Card` in `DetailListRow` with `ListCard`.

- [ ] **Step 4: Migrate all tappable list rows**

Use `ListCard` for:

- Calendar selected-date event rows;
- Notification rows;
- Grocery item rows;
- Budget category rows;
- Ledger transaction rows;
- Asset, transfer, and recurring-transfer rows;
- Trip itinerary, booking, checklist, and expense rows.

Root Grocery, Statement, Note, and Trip rows inherit the new radius through
`DetailListRow`.

Do not replace Calendar month cards, Ledger summaries/charts, Budget metrics,
Trip currency total cards, form fieldsets, or state cards.

- [ ] **Step 5: Verify focused UI tests**

Run:

```bash
npm --prefix mobile test -- --runInBand \
  src/components/ListCard.test.tsx \
  src/components/DetailListRow.test.tsx \
  src/features/groceries/GroceryItemActions.test.tsx \
  src/features/ledger/StatementYearList.test.tsx \
  src/features/trips/TripScreen.test.tsx
```

Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/ListCard.tsx \
  mobile/src/components/ListCard.test.tsx \
  mobile/src/components/DetailListRow.tsx \
  mobile/app/notifications.tsx \
  'mobile/app/(tabs)/index.tsx' \
  'mobile/app/(tabs)/groceries/[listId].tsx' \
  'mobile/app/(tabs)/ledger/[yearId].tsx' \
  mobile/src/features/ledger/TransactionList.tsx \
  mobile/src/features/ledger/AssetsTab.tsx \
  'mobile/app/(tabs)/trips/[tripId].tsx'
git commit -m "style(mobile): unify list item radius"
```

---

### Task 3: Build pure Trip date-range behavior

**Files:**
- Create: `mobile/src/features/trips/dateRange.ts`
- Create: `mobile/src/features/trips/dateRange.test.ts`

**Interfaces:**
- Produces:

```ts
export interface TripDateRange {
  startDate: string
  endDate: string | null
}

export function localDateKey(date: Date): string
export function nextCivilDate(dateKey: string): string
export function defaultTripDateRange(now?: Date): Required<TripDateRange>
export function selectTripRangeDate(
  current: TripDateRange,
  selectedDate: string,
): TripDateRange
export function formatTripDateRange(startDate: string, endDate: string): string
export function monthFromDateKey(dateKey: string): {
  year: number
  month1: number
}
```

- [ ] **Step 1: Write failing civil-date tests**

Use hand-derived literals:

```ts
expect(defaultTripDateRange(new Date(2026, 6, 26, 20))).toEqual({
  startDate: '2026-07-26',
  endDate: '2026-07-27',
})
expect(nextCivilDate('2026-12-31')).toBe('2027-01-01')
```

- [ ] **Step 2: Write failing range-transition tests**

Cover:

```ts
selectTripRangeDate(
  { startDate: '2026-07-26', endDate: '2026-07-27' },
  '2026-08-03',
)
// => { startDate: '2026-08-03', endDate: null }

selectTripRangeDate(
  { startDate: '2026-08-03', endDate: null },
  '2026-08-03',
)
// => same-day complete range

selectTripRangeDate(
  { startDate: '2026-08-03', endDate: null },
  '2026-08-06',
)
// => forward complete range

selectTripRangeDate(
  { startDate: '2026-08-03', endDate: null },
  '2026-08-01',
)
// => restart at August 1 with null End
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
npm --prefix mobile test -- --runInBand src/features/trips/dateRange.test.ts
```

Expected: module/functions are missing.

- [ ] **Step 4: Implement pure helpers**

Parse and increment civil dates using numeric year/month/day values. Do not
round-trip Trip keys through ISO UTC strings. Compare valid date keys
lexicographically because the format is fixed-width `YYYY-MM-DD`.

Use `Intl.DateTimeFormat` with `timeZone: 'UTC'` only for display from
`Date.UTC(...)`; stored keys remain untouched.

- [ ] **Step 5: Run tests and verify GREEN**

Run the same focused command. Expected: all helper tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/features/trips/dateRange.ts \
  mobile/src/features/trips/dateRange.test.ts
git commit -m "feat(mobile): add trip date range logic"
```

---

### Task 4: Build the single-calendar Trip range picker

**Files:**
- Create: `mobile/src/features/trips/TripDateRangeField.tsx`
- Create: `mobile/src/features/trips/TripDateRangeField.test.tsx`
- Modify: `mobile/src/features/trips/TripSheet.tsx`
- Create: `mobile/src/features/trips/TripSheet.test.tsx`

**Interfaces:**
- Consumes: Task 3 date helpers and Calendar's `buildMonthGrid`,
  `datesInSpan`, `monthLabel`, and `shiftMonth`.
- Produces:

```ts
export function TripDateRangeField(props: {
  startDate: string
  endDate: string
  onChange: (range: { startDate: string; endDate: string }) => void
}): ReactElement
```

- [ ] **Step 1: Write failing range-field interaction tests**

Render a saved July 26–27 range and assert the collapsed label. Open the field,
select July 30 and August 2 using accessibility labels, navigate to August,
press Done, and assert:

```ts
expect(onChange).toHaveBeenCalledWith({
  startDate: '2026-07-30',
  endDate: '2026-08-02',
})
```

Open again, change the draft, press Cancel, and assert no additional change.
Assert Done is disabled after only the first endpoint.

- [ ] **Step 2: Run the field test and verify RED**

Run:

```bash
npm --prefix mobile test -- --runInBand \
  src/features/trips/TripDateRangeField.test.tsx
```

Expected: component is missing.

- [ ] **Step 3: Implement the modal range field**

Build:

- a full-width collapsed `Pressable` labelled `Trip dates`;
- a React Native `Modal` using `presentationStyle="pageSheet"`;
- one 42-cell month grid;
- previous/next 44-point controls;
- endpoint circles and an inclusive middle-range tint;
- Cancel and Done controls;
- draft state initialized from props every time the modal opens.

Use `StyleSheet.create`, `Pressable`, `SafeAreaView`, and semantic theme tokens.
Do not add a dependency or nest another `BottomSheet`.

- [ ] **Step 4: Run the field test and verify GREEN**

Run the same focused command. Expected: all interaction assertions pass.

- [ ] **Step 5: Write the failing `TripSheet` integration test**

Freeze the clock at July 26, 2026. Render a new Trip, fill Name and
Destination, use the real range field to choose July 30–August 2, then Save.
Mock the operation boundary and assert `saveTrip()` receives:

```ts
expect.objectContaining({
  startDate: '2026-07-30',
  endDate: '2026-08-02',
})
```

Also assert a new form initially displays July 26–July 27.

- [ ] **Step 6: Run the integration test and verify RED**

Run:

```bash
npm --prefix mobile test -- --runInBand src/features/trips/TripSheet.test.tsx
```

Expected: the old separate Start and End controls are present and the new
range field is absent.

- [ ] **Step 7: Integrate the range field**

Store Trip form dates as civil keys:

```ts
const initialRange = trip
  ? { startDate: trip.startDate, endDate: trip.endDate }
  : defaultTripDateRange()
```

Replace both `DateTimeField` instances with:

```tsx
<TripDateRangeField
  startDate={startDate}
  endDate={endDate}
  onChange={(range) => {
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }}
/>
```

Submit those keys directly to `saveTrip()`. Keep End-on-or-after-Start
validation as defense in depth.

- [ ] **Step 8: Run focused Trip tests and verify GREEN**

Run:

```bash
npm --prefix mobile test -- --runInBand \
  src/features/trips/dateRange.test.ts \
  src/features/trips/TripDateRangeField.test.tsx \
  src/features/trips/TripSheet.test.tsx \
  src/features/trips/TripsIndex.test.tsx \
  src/features/trips/TripScreen.test.tsx
```

Expected: all suites pass without new warnings.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/features/trips/dateRange.ts \
  mobile/src/features/trips/dateRange.test.ts \
  mobile/src/features/trips/TripDateRangeField.tsx \
  mobile/src/features/trips/TripDateRangeField.test.tsx \
  mobile/src/features/trips/TripSheet.tsx \
  mobile/src/features/trips/TripSheet.test.tsx
git commit -m "feat(mobile): select trip dates as one range"
```

---

### Task 5: Verify and document the correction pass

**Files:**
- Modify: `progress.md`
- Modify: `docs/superpowers/progress-detail.md`

**Interfaces:**
- Consumes: all corrected native behavior from Tasks 1–4.
- Produces: concise continuation status and detailed implementation evidence.

- [ ] **Step 1: Run the full native suite**

```bash
npm --prefix mobile test -- --runInBand
```

Expected: all suites and tests pass.

- [ ] **Step 2: Run static and production checks**

```bash
npm --prefix mobile run typecheck
npm run lint
npm run build
```

Expected: all commands exit successfully. Record any non-failing warnings
exactly.

- [ ] **Step 3: Run scoped source checks**

```bash
git diff --check -- mobile progress.md docs/superpowers
git status --short --branch
```

Expected: no whitespace errors in files from this pass; unrelated existing
working-tree files remain untouched.

- [ ] **Step 4: Update continuation documentation**

Record:

- the Statement deletion projection root cause and legacy queue repair;
- the exact list surfaces migrated to `radiusControl`;
- the Trip range selection rules and component boundary;
- focused and full verification counts;
- remaining simulator/device acceptance checks.

- [ ] **Step 5: Commit documentation**

```bash
git add progress.md docs/superpowers/progress-detail.md
git commit -m "docs: record native list and trip date corrections"
```
