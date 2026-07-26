# Mobile UI Consistency Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct Schedule date geometry, center native page titles, standardize root list actions, restore the approved Statement/Budget navigation, and make Ledger category and transaction prerequisites work offline and explain themselves.

**Architecture:** Keep the existing Expo Router screens, Supabase operation contract, TanStack Query cache, and SQLite FIFO queue. Extract only small UI units with observable behavior, lift Statement creation to the Ledger route so it can use the shared floating action button, and derive Ledger category/limit optimistic rows from queued commands before presenting Budget data.

**Tech Stack:** Expo SDK 57.0.8, React Native 0.86, React 19.2.3, Expo Router 57, TanStack Query 5, Supabase, SQLite operation queue, Jest, and React Native Testing Library.

## Global Constraints

- Work only in `/Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first`.
- Preserve all existing dirty-worktree changes and untracked design references.
- Do not start Task 9, production reset, deployment, or physical-device release acceptance.
- Preserve the five destinations: Schedule, Groceries, Ledger, Notes, and Trips. There is no Home destination.
- Keep notification and Settings as the only persistent header actions.
- Only today's Calendar date displays a visible circle. Other date numbers remain unframed unless selected, and event dots must never move their vertical position.
- Ledger income and spending remain CAD transactions linked to a CAD Asset.
- Statement year deletion retains the existing typed four-digit year confirmation and server operation.
- Month arrows stop at January and December; tapping the month opens the full 12-month picker.
- No new dependencies are required.
- Expo SDK 57 documentation was checked at `https://docs.expo.dev/versions/v57.0.0/` before implementation.
- Do not commit from this shared dirty worktree. End each task with targeted tests and `git diff --check` for the exact files instead.

---

### Task 1: Centered Header and Stable Schedule Dates

**Files:**

- Create: `mobile/src/components/AppHeader.test.tsx`
- Modify: `mobile/src/components/AppHeader.tsx`
- Modify: `mobile/src/features/calendar/layout.test.ts`
- Modify: `mobile/src/features/calendar/layout.ts`
- Modify: `mobile/app/(tabs)/index.tsx`

**Interfaces:**

- Produces: `titleForPath(pathname: string): string`
- Produces: `CALENDAR_DATE_SURFACE_SIZE = 32`
- Produces: `CALENDAR_TODAY_RADIUS = CALENDAR_DATE_SURFACE_SIZE / 2`
- Consumes: existing `CALENDAR_DAY_CELL_HEIGHT`

- [ ] **Step 1: Write failing header tests**

Create `mobile/src/components/AppHeader.test.tsx`:

```tsx
import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { AppHeader, titleForPath } from './AppHeader'

const push = jest.fn()

jest.mock('expo-router', () => ({
  usePathname: () => '/ledger/year-id',
  useRouter: () => ({ push }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

describe('AppHeader', () => {
  it('names a Ledger year detail Budget', () => {
    expect(titleForPath('/ledger')).toBe('Ledger')
    expect(titleForPath('/ledger/11111111-1111-4111-8111-111111111111')).toBe('Budget')
  })

  it('centers the title independently of the right-side actions', async () => {
    const view = await render(<AppHeader />)
    const titleLayer = view.getByTestId('app-header-title-layer')
    expect(StyleSheet.flatten(titleLayer.props.style)).toMatchObject({
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
    })
  })
})
```

- [ ] **Step 2: Run the header test and verify RED**

Run:

```bash
cd mobile
npx jest src/components/AppHeader.test.tsx --runInBand
```

Expected: FAIL because `titleForPath` is not exported, the detail route still resolves to `Ledger`, and the centered title layer does not exist.

- [ ] **Step 3: Implement route-aware centered header**

Update `mobile/src/components/AppHeader.tsx`:

```tsx
export function titleForPath(pathname: string): string {
  if (/^\/ledger\/[^/]+$/.test(pathname)) return 'Budget'
  const match = TAB_DESTINATIONS.find((destination) =>
    tabActiveForPath(destination.path, pathname),
  )
  return match?.label ?? 'Household Hub'
}
```

Render the title in an absolute, pointer-events-free layer before the action group:

```tsx
<View
  testID="app-header-title-layer"
  pointerEvents="none"
  style={styles.titleLayer}
>
  <Text accessibilityRole="header" style={[styles.title, { color: tokens.ink }]}>
    {titleForPath(pathname)}
  </Text>
</View>
<View style={styles.actionSpacer} />
<View style={styles.actions}>{/* existing Bell and Cog buttons */}</View>
```

Use:

```tsx
row: {
  position: 'relative',
  minHeight: 48,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 20,
  paddingBottom: 6,
},
titleLayer: {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 6,
  height: 36,
  alignItems: 'center',
  justifyContent: 'center',
},
actionSpacer: { width: 80 },
```

- [ ] **Step 4: Verify the header test GREEN**

Run:

```bash
cd mobile
npx jest src/components/AppHeader.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Write failing Calendar geometry tests**

Extend `mobile/src/features/calendar/layout.test.ts`:

```ts
import {
  CALENDAR_DATE_SURFACE_SIZE,
  CALENDAR_DAY_CELL_HEIGHT,
  CALENDAR_TODAY_RADIUS,
} from './layout'

describe('Calendar month layout', () => {
  it('keeps enough vertical room for a centered date and independent event dot', () => {
    expect(CALENDAR_DAY_CELL_HEIGHT).toBeGreaterThan(CALENDAR_DATE_SURFACE_SIZE)
  })

  it('uses equal dimensions and a half-size radius for today', () => {
    expect(CALENDAR_DATE_SURFACE_SIZE).toBe(32)
    expect(CALENDAR_TODAY_RADIUS).toBe(16)
  })
})
```

- [ ] **Step 6: Run the Calendar test and verify RED**

Run:

```bash
cd mobile
npx jest src/features/calendar/layout.test.ts --runInBand
```

Expected: FAIL because the new geometry exports do not exist.

- [ ] **Step 7: Implement stable date surfaces**

Add to `mobile/src/features/calendar/layout.ts`:

```ts
export const CALENDAR_DATE_SURFACE_SIZE = 32
export const CALENDAR_TODAY_RADIUS = CALENDAR_DATE_SURFACE_SIZE / 2
```

In `mobile/app/(tabs)/index.tsx`, import the new values. Move selected/today styling from the full cell to a fixed surface:

```tsx
<Pressable
  key={cell.date}
  accessibilityRole="button"
  accessibilityLabel={`${cell.date}${isToday ? ', today' : ''}`}
  accessibilityState={{ selected: isSelected }}
  onPress={() => setSelected(cell.date)}
  style={styles.cell}
>
  <View
    style={[
      styles.dateSurface,
      isSelected && {
        backgroundColor: tokens.accent,
        borderRadius: isToday ? CALENDAR_TODAY_RADIUS : 10,
      },
      isToday &&
        !isSelected && [
          styles.todayRing,
          { borderColor: tokens.accent },
        ],
    ]}
  >
    <Text>{cell.day}</Text>
  </View>
  {hasEvent ? <View style={styles.dot} /> : null}
</Pressable>
```

Use:

```tsx
dateSurface: {
  width: CALENDAR_DATE_SURFACE_SIZE,
  height: CALENDAR_DATE_SURFACE_SIZE,
  alignItems: 'center',
  justifyContent: 'center',
},
todayRing: {
  borderWidth: 1,
  borderRadius: CALENDAR_TODAY_RADIUS,
},
dot: {
  position: 'absolute',
  bottom: 3,
  width: 4,
  height: 4,
  borderRadius: 2,
},
```

Do not apply a background or border radius to the full cell.

- [ ] **Step 8: Verify Task 1**

Run:

```bash
cd mobile
npx jest src/components/AppHeader.test.tsx src/features/calendar/layout.test.ts --runInBand
git diff --check -- mobile/src/components/AppHeader.tsx mobile/src/components/AppHeader.test.tsx mobile/src/features/calendar/layout.ts mobile/src/features/calendar/layout.test.ts 'mobile/app/(tabs)/index.tsx'
```

Expected: all tests PASS and no whitespace errors.

---

### Task 2: Reusable Navigable List Rows and Root Deletion

**Files:**

- Create: `mobile/src/components/DetailListRow.tsx`
- Create: `mobile/src/components/DetailListRow.test.tsx`
- Modify: `mobile/app/(tabs)/groceries/index.tsx`
- Modify: `mobile/app/(tabs)/notes/index.tsx`
- Modify: `mobile/app/(tabs)/trips/index.tsx`

**Interfaces:**

- Produces:

```ts
interface DetailListRowProps {
  title: string
  subtitle?: string
  openLabel: string
  deleteLabel: string
  onOpen: () => void
  onDelete: () => void
  secondaryAction?: {
    label: string
    icon: ReactNode
    onPress: () => void
    expanded?: boolean
  }
}
```

- Consumes: `Card`, `TrashIcon`, and existing root delete mutations.

- [ ] **Step 1: Write the failing row interaction test**

Create `mobile/src/components/DetailListRow.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react-native'

import { DetailListRow } from './DetailListRow'

describe('DetailListRow', () => {
  it('keeps navigation and deletion as independent actions', async () => {
    const onOpen = jest.fn()
    const onDelete = jest.fn()
    const view = await render(
      <DetailListRow
        title="Costco"
        openLabel="Open Costco"
        deleteLabel="Delete Costco"
        onOpen={onOpen}
        onDelete={onDelete}
      />,
    )

    fireEvent.press(view.getByLabelText('Delete Costco'))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()

    fireEvent.press(view.getByLabelText('Open Costco'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the row test and verify RED**

Run:

```bash
cd mobile
npx jest src/components/DetailListRow.test.tsx --runInBand
```

Expected: FAIL because `DetailListRow` does not exist.

- [ ] **Step 3: Implement `DetailListRow`**

Create `mobile/src/components/DetailListRow.tsx` using a `View`/`Card` with sibling press targets rather than a nested Pressable:

```tsx
export function DetailListRow(props: DetailListRowProps) {
  const { tokens } = useTheme()
  return (
    <Card style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.openLabel}
        onPress={props.onOpen}
        style={styles.main}
      >
        <Text style={[styles.title, { color: tokens.ink }]} numberOfLines={1}>
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text style={[styles.subtitle, { color: tokens.muted }]} numberOfLines={1}>
            {props.subtitle}
          </Text>
        ) : null}
      </Pressable>
      {props.secondaryAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.secondaryAction.label}
          accessibilityState={{ expanded: props.secondaryAction.expanded }}
          onPress={props.secondaryAction.onPress}
          style={[styles.iconButton, { backgroundColor: tokens.cardAlt }]}
        >
          {props.secondaryAction.icon}
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.deleteLabel}
        onPress={props.onDelete}
        style={[styles.iconButton, { backgroundColor: tokens.cardAlt }]}
      >
        <TrashIcon size={18} color={tokens.danger} />
      </Pressable>
    </Card>
  )
}
```

Use a minimum 44×44 point icon target and `main: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' }`.

- [ ] **Step 4: Verify the row test GREEN**

Run:

```bash
cd mobile
npx jest src/components/DetailListRow.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Replace Grocery, Note, and Trip root rows**

For each root screen:

1. Replace the outer row Pressable and Chevron with `DetailListRow`.
2. Add entity-specific deletion state.
3. Render `ConfirmDialog`.
4. Await the existing mutation and clear the target only after it resolves.

Example for Groceries:

```tsx
const [deleting, setDeleting] = useState<GroceryList | null>(null)

async function confirmDelete() {
  if (!householdId || !deleting) return
  await deleteGroceryList(householdId, deleting.id, deleting.revision)
  setDeleting(null)
}

<DetailListRow
  title={item.name}
  openLabel={`Open ${item.name}`}
  deleteLabel={`Delete ${item.name}`}
  onOpen={() => openList(item)}
  onDelete={() => setDeleting(item)}
/>

<ConfirmDialog
  open={!!deleting}
  onOpenChange={(open) => {
    if (!open) setDeleting(null)
  }}
  title={`Delete ${deleting?.name ?? 'list'}?`}
  description="This permanently removes the list and all of its items."
  confirmLabel="Delete"
  onConfirm={() => void confirmDelete()}
/>
```

For Notes:

```tsx
const [deleting, setDeleting] = useState<NoteSummary | null>(null)

async function confirmDelete() {
  if (!householdId || !deleting) return
  await deleteNote(householdId, deleting.id, deleting.revision)
  setDeleting(null)
}

<DetailListRow
  title={item.title}
  openLabel={`Open ${item.title}`}
  deleteLabel={`Delete ${item.title}`}
  onOpen={() => openNote(item)}
  onDelete={() => setDeleting(item)}
/>
```

For Trips:

```tsx
const [deleting, setDeleting] = useState<Trip | null>(null)

async function confirmDelete() {
  if (!householdId || !deleting) return
  await deleteTrip(householdId, deleting.id, deleting.revision)
  setDeleting(null)
}

<DetailListRow
  title={item.name}
  subtitle={`${item.destination} · ${formatRange(item.startDate, item.endDate)}`}
  openLabel={`Open ${item.name}`}
  deleteLabel={`Delete ${item.name}`}
  onOpen={() => openTrip(item)}
  onDelete={() => setDeleting(item)}
/>
```

Each screen renders its own `ConfirmDialog` with the entity name and calls the
corresponding `confirmDelete` function.

- [ ] **Step 6: Verify Task 2**

Run:

```bash
cd mobile
npx jest src/components/DetailListRow.test.tsx src/components/ConfirmDialog.test.tsx --runInBand
git diff --check -- mobile/src/components/DetailListRow.tsx mobile/src/components/DetailListRow.test.tsx 'mobile/app/(tabs)/groceries/index.tsx' 'mobile/app/(tabs)/notes/index.tsx' 'mobile/app/(tabs)/trips/index.tsx'
```

Expected: all tests PASS and no whitespace errors.

---

### Task 3: Statement FAB, Row Actions, and Typed Deletion

**Files:**

- Modify: `mobile/src/components/icons.tsx`
- Create: `mobile/src/features/ledger/StatementYearList.test.tsx`
- Modify: `mobile/src/features/ledger/StatementYearList.tsx`
- Modify: `mobile/src/features/ledger/StatementsTab.tsx`
- Modify: `mobile/src/features/ledger/ClearYearSheet.tsx`
- Modify: `mobile/app/(tabs)/ledger/index.tsx`

**Interfaces:**

- Produces: `ChartBarIcon`
- Changes:

```ts
StatementsTab({
  householdId,
  onCreateYear,
}: {
  householdId: string
  onCreateYear: () => void
})
```

- Consumes: `DetailListRow`, `FloatingActionButton`, `NewYearSheet`, and `ClearYearSheet`.

- [ ] **Step 1: Write failing Statement row tests**

Create `mobile/src/features/ledger/StatementYearList.test.tsx` with real `StatementYearList`, mocked theme/router, and a mocked lightweight `StatementYearSummary`:

```tsx
it('opens Budget from the main year action and not from report or delete', async () => {
  const view = await render(
    <StatementYearList householdId="household" years={[year2026]} />,
  )

  fireEvent.press(view.getByLabelText('Show 2026 report'))
  expect(push).not.toHaveBeenCalled()
  expect(view.getByText('Annual report')).toBeTruthy()

  fireEvent.press(view.getByLabelText('Delete 2026 statement'))
  expect(push).not.toHaveBeenCalled()
  expect(view.getByText('Delete 2026?')).toBeTruthy()

  fireEvent.press(view.getByLabelText('Open 2026 budget'))
  expect(push).toHaveBeenCalledWith({
    pathname: '/ledger/[yearId]',
    params: { yearId: year2026.id },
  })
})
```

- [ ] **Step 2: Run the Statement row test and verify RED**

Run:

```bash
cd mobile
npx jest src/features/ledger/StatementYearList.test.tsx --runInBand
```

Expected: FAIL because the current row uses ellipsis/chevron actions, the main content does not navigate, and deletion is absent.

- [ ] **Step 3: Add the report icon and rebuild the Statement row**

Add `ChartBarIcon` to `mobile/src/components/icons.tsx` from the Heroicons outline chart-bar path:

```ts
export const ChartBarIcon = outline([
  'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
])
```

In `StatementYearList`, use `DetailListRow`:

```tsx
<DetailListRow
  title={String(year.year)}
  subtitle="12-month statement"
  openLabel={`Open ${year.year} budget`}
  deleteLabel={`Delete ${year.year} statement`}
  onOpen={() =>
    router.push({ pathname: '/ledger/[yearId]', params: { yearId: year.id } })
  }
  onDelete={() => setDeleting(year)}
  secondaryAction={{
    label: `${isExpanded ? 'Hide' : 'Show'} ${year.year} report`,
    expanded: isExpanded,
    onPress: () => toggle(year.id),
    icon: isExpanded ? (
      <ChevronDownIcon size={18} color={tokens.ink} />
    ) : (
      <ChartBarIcon size={18} color={tokens.ink} />
    ),
  }}
/>
```

Render `ClearYearSheet` for the selected year outside the map.

- [ ] **Step 4: Update deletion copy**

Change `ClearYearSheet` user-facing copy only:

```tsx
title={`Delete ${year.year}?`}
```

Description:

```text
This permanently deletes the statement, all 12 monthly budgets, categories, limits, and transactions in 2026. Type 2026 to confirm.
```

Confirm label: `Delete ${year.year}`.

- [ ] **Step 5: Verify Statement row GREEN**

Run:

```bash
cd mobile
npx jest src/features/ledger/StatementYearList.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Lift Statement creation to the Ledger route**

Change `StatementsTab` to receive `onCreateYear`, remove its `NewYearSheet` state/import, remove the `+ Year` row, and wire the empty-state action to `onCreateYear`.

In `mobile/app/(tabs)/ledger/index.tsx`:

```tsx
const years = useLedgerYears(householdId)
const [newYearOpen, setNewYearOpen] = useState(false)

<StatementsTab
  householdId={householdId}
  onCreateYear={() => setNewYearOpen(true)}
/>

{segment === 'statements' ? (
  <FloatingActionButton
    accessibilityLabel="New statement year"
    onPress={() => setNewYearOpen(true)}
  />
) : null}

{householdId ? (
  <NewYearSheet
    open={newYearOpen}
    onOpenChange={setNewYearOpen}
    householdId={householdId}
    years={years.data ?? []}
  />
) : null}
```

Increase the Ledger ScrollView bottom padding so the FAB does not cover the last row.

- [ ] **Step 7: Verify Task 3**

Run:

```bash
cd mobile
npx jest src/features/ledger/StatementYearList.test.tsx src/components/FloatingActionButton.test.tsx --runInBand
git diff --check -- mobile/src/components/icons.tsx mobile/src/features/ledger/StatementYearList.tsx mobile/src/features/ledger/StatementYearList.test.tsx mobile/src/features/ledger/StatementsTab.tsx mobile/src/features/ledger/ClearYearSheet.tsx 'mobile/app/(tabs)/ledger/index.tsx'
```

Expected: all tests PASS and no whitespace errors.

---

### Task 4: Compact Budget Month Selector and Detail Cleanup

**Files:**

- Create: `mobile/src/features/ledger/BudgetMonthSelector.tsx`
- Create: `mobile/src/features/ledger/BudgetMonthSelector.test.tsx`
- Modify: `mobile/app/(tabs)/ledger/[yearId].tsx`

**Interfaces:**

- Produces:

```ts
interface BudgetMonthSelectorProps {
  month: number
  onChange: (month: number) => void
}
```

- [ ] **Step 1: Write failing month-selector tests**

Create `mobile/src/features/ledger/BudgetMonthSelector.test.tsx`:

```tsx
it('moves one month at a time and stops at year boundaries', async () => {
  const onChange = jest.fn()
  const january = await render(
    <BudgetMonthSelector month={1} onChange={onChange} />,
  )
  expect(january.getByLabelText('Previous month')).toBeDisabled()
  fireEvent.press(january.getByLabelText('Next month'))
  expect(onChange).toHaveBeenCalledWith(2)

  january.rerender(<BudgetMonthSelector month={12} onChange={onChange} />)
  expect(january.getByLabelText('Next month')).toBeDisabled()
})

it('opens all months on demand and collapses after selection', async () => {
  const onChange = jest.fn()
  const view = await render(
    <BudgetMonthSelector month={7} onChange={onChange} />,
  )

  expect(view.queryByLabelText('Choose January')).toBeNull()
  fireEvent.press(view.getByLabelText('Choose month, July selected'))
  expect(view.getByLabelText('Choose January')).toBeTruthy()

  fireEvent.press(view.getByLabelText('Choose January'))
  expect(onChange).toHaveBeenCalledWith(1)
  expect(view.queryByLabelText('Choose February')).toBeNull()
})
```

- [ ] **Step 2: Run the month-selector tests and verify RED**

Run:

```bash
cd mobile
npx jest src/features/ledger/BudgetMonthSelector.test.tsx --runInBand
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the selector**

Create a component with internal `expanded` state:

```tsx
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function BudgetMonthSelector({ month, onChange }: BudgetMonthSelectorProps) {
  const { tokens } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const choose = (next: number) => {
    onChange(next)
    setExpanded(false)
  }

  return (
    <View>
      <Card style={styles.navigator}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: month === 1 }}
          disabled={month === 1}
          onPress={() => onChange(month - 1)}
          style={month === 1 && styles.disabled}
        >
          <ChevronLeftIcon size={20} color={tokens.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose month, ${LONG_MONTHS[month - 1]} selected`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={styles.monthLabelButton}
        >
          <Text style={[styles.monthLabel, { color: tokens.ink }]}>
            {LONG_MONTHS[month - 1]}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: month === 12 }}
          disabled={month === 12}
          onPress={() => onChange(month + 1)}
          style={month === 12 && styles.disabled}
        >
          <ChevronRightIcon size={20} color={tokens.muted} />
        </Pressable>
      </Card>
      {expanded ? (
        <Card style={styles.grid}>
          {SHORT_MONTHS.map((label, index) => {
            const value = index + 1
            const active = value === month
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${LONG_MONTHS[index]}`}
                accessibilityState={{ selected: active }}
                onPress={() => choose(value)}
                style={[
                  styles.monthCell,
                  {
                    backgroundColor: active ? tokens.ink : tokens.cardAlt,
                    borderRadius: tokens.radiusControl,
                  },
                ]}
              >
                <Text style={{ color: active ? tokens.canvas : tokens.ink }}>
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </Card>
      ) : null}
    </View>
  )
}
```

Requirements:

- previous disabled at `month === 1`;
- next disabled at `month === 12`;
- disabled icon opacity is visible and accessibility state is set;
- the collapsed label uses the long month name;
- the expanded active month uses ink background and canvas text;
- grid uses four columns and three rows.

- [ ] **Step 4: Verify the selector GREEN**

Run:

```bash
cd mobile
npx jest src/features/ledger/BudgetMonthSelector.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Integrate the selector and remove duplicate Budget controls**

In `mobile/app/(tabs)/ledger/[yearId].tsx`:

- remove `ClearYearSheet`, `clearOpen`, the duplicate `titleRow`, `Budget {year}`, and `Clear year`;
- replace the always-visible 12-month grid with:

```tsx
<BudgetMonthSelector month={month} onChange={setMonth} />
```

- keep the compact `‹ Ledger` back control;
- remove obsolete title/grid styles.

- [ ] **Step 6: Verify Task 4**

Run:

```bash
cd mobile
npx jest src/features/ledger/BudgetMonthSelector.test.tsx src/components/AppHeader.test.tsx --runInBand
git diff --check -- mobile/src/features/ledger/BudgetMonthSelector.tsx mobile/src/features/ledger/BudgetMonthSelector.test.tsx 'mobile/app/(tabs)/ledger/[yearId].tsx'
```

Expected: all tests PASS and no whitespace errors.

---

### Task 5: Offline Ledger Category and Limit Read Model

**Files:**

- Modify: `mobile/src/features/ledger/statements.test.ts`
- Modify: `mobile/src/features/ledger/statements.ts`

**Interfaces:**

- Produces:

```ts
export function applyLedgerConfigurationOverlay(
  data: LedgerYearData,
  operations: QueuedOperation[],
  yearId: string,
): LedgerYearData
```

- Consumes: `QueuedOperation` and `getOperationStore().listOperations()`.

- [ ] **Step 1: Write failing optimistic configuration tests**

Extend `mobile/src/features/ledger/statements.test.ts` with literal queued commands:

```ts
function queued(input: {
  localSequence: number
  entityType: string
  entityId: string
  type: OperationCommand['type']
  payload: Record<string, unknown>
}): QueuedOperation {
  return {
    operationId: `operation-${input.localSequence}`,
    localSequence: input.localSequence,
    householdId: 'household',
    entityType: input.entityType,
    entityId: input.entityId,
    command: {
      version: 1,
      operationId: `operation-${input.localSequence}`,
      householdId: 'household',
      deviceId: 'device',
      localSequence: input.localSequence,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      baseRevision: null,
      payload: input.payload,
      occurredAt: '2026-07-26T00:00:00.000Z',
    },
    optimistic: input.payload,
    enqueuedAt: '2026-07-26T00:00:00.000Z',
    attempts: 0,
    lastError: null,
  }
}

it('shows a queued category and limit from the selected month through December', () => {
  const result = applyLedgerConfigurationOverlay(
    data({}),
    [
      queued({
        localSequence: 1,
        entityType: 'ledger_category',
        entityId: 'food',
        type: 'ledger.category.upsert',
        payload: {
          yearId: 'year',
          fromMonth: 7,
          name: 'Food',
          kind: 'spending',
          sortOrder: 0,
        },
      }),
      queued({
        localSequence: 2,
        entityType: 'ledger_limit',
        entityId: 'food',
        type: 'ledger.limit.upsert',
        payload: {
          categoryId: 'food',
          fromMonth: 7,
          amountCents: 40000,
        },
      }),
    ],
    'year',
  )

  expect(result.categories.map((row) => row.monthId)).toEqual([
    'm7', 'm8', 'm9', 'm10', 'm11', 'm12',
  ])
  expect(categoryProgress(result, 'm7')[0]).toMatchObject({
    name: 'Food',
    limitCents: 40000,
  })
})

it('applies queued edits and deletes in FIFO order', () => {
  const initial = data({
    categories: MONTHS.slice(6).map((month) => ({
      id: `food:${month.id}`,
      categoryId: 'food',
      monthId: month.id,
      name: 'Food',
      kind: 'spending',
      sortOrder: 0,
      revision: 1,
    })),
  })
  const result = applyLedgerConfigurationOverlay(
    initial,
    [
      queued({
        localSequence: 2,
        entityType: 'ledger_category',
        entityId: 'food',
        type: 'ledger.category.upsert',
        payload: {
          yearId: 'year',
          fromMonth: 7,
          name: 'Dining',
          kind: 'spending',
          sortOrder: 0,
        },
      }),
      queued({
        localSequence: 3,
        entityType: 'ledger_category',
        entityId: 'food',
        type: 'ledger.category.delete',
        payload: { fromMonth: 10 },
      }),
    ],
    'year',
  )

  expect(result.categories.map((row) => [row.monthId, row.name])).toEqual([
    ['m7', 'Dining'],
    ['m8', 'Dining'],
    ['m9', 'Dining'],
  ])
})

it('ignores configuration commands belonging to another year', () => {
  const initial = data({})
  const result = applyLedgerConfigurationOverlay(
    initial,
    [
      queued({
        localSequence: 1,
        entityType: 'ledger_category',
        entityId: 'food',
        type: 'ledger.category.upsert',
        payload: {
          yearId: 'other-year',
          fromMonth: 1,
          name: 'Food',
          kind: 'spending',
          sortOrder: 0,
        },
      }),
    ],
    'year',
  )

  expect(result).toEqual(initial)
})
```

The `queued` fixture must populate the complete `QueuedOperation` shape and use literal expected results.

- [ ] **Step 2: Run Ledger calculation tests and verify RED**

Run:

```bash
cd mobile
npx jest src/features/ledger/statements.test.ts --runInBand
```

Expected: FAIL because `applyLedgerConfigurationOverlay` does not exist.

- [ ] **Step 3: Implement FIFO configuration overlay**

In `statements.ts`:

1. Sort relevant operations by `localSequence`.
2. For category upsert, update or insert a `MonthCategory` for every month `>= fromMonth`.
3. For category delete, remove matching categories and limits for every month `>= fromMonth`.
4. For limit upsert, update or insert a `MonthLimit` for every month `>= fromMonth`.
5. Use stable local IDs such as `${categoryId}:${month.id}` only when no authoritative row exists.
6. Preserve transactions unchanged.
7. Ignore category upserts whose `payload.yearId !== yearId`.
8. Apply a category delete only if the category already belongs to the supplied year data.

After building authoritative data in `useLedgerYearData`, read the durable queue and apply the helper:

```ts
const operations = await getOperationStore().listOperations()
return applyLedgerConfigurationOverlay(
  ensureLedgerYearMonths(yearId!, authoritative),
  operations,
  yearId!,
)
```

- [ ] **Step 4: Verify Task 5**

Run:

```bash
cd mobile
npx jest src/features/ledger/statements.test.ts --runInBand
git diff --check -- mobile/src/features/ledger/statements.ts mobile/src/features/ledger/statements.test.ts
```

Expected: all Ledger tests PASS and no whitespace errors.

---

### Task 6: Category Outcome Handling and Transaction Prerequisites

**Files:**

- Create: `mobile/src/features/ledger/CategorySheet.test.tsx`
- Modify: `mobile/src/features/ledger/CategorySheet.tsx`
- Create: `mobile/src/features/ledger/TransactionPrerequisiteDialog.test.tsx`
- Create: `mobile/src/features/ledger/TransactionPrerequisiteDialog.tsx`
- Modify: `mobile/src/features/ledger/AssetSheet.tsx`
- Modify: `mobile/src/features/ledger/AssetsTab.tsx`
- Modify: `mobile/app/(tabs)/ledger/index.tsx`
- Modify: `mobile/app/(tabs)/ledger/[yearId].tsx`

**Interfaces:**

- Changes:

```ts
CategorySheetProps {
  initialKind?: CategoryKind
  onSaved?: (kind: CategoryKind) => void
}

AssetSheetProps {
  onSaved?: () => void
}

AssetsTabProps {
  householdId: string
  requestNewAsset?: boolean
  onNewAssetRequestHandled?: () => void
  onExternalAssetCreated?: () => void
}
```

- Produces:

```ts
type TransactionPrerequisite = 'asset' | 'category'

interface TransactionPrerequisiteDialogProps {
  open: boolean
  prerequisite: TransactionPrerequisite
  kind: CategoryKind
  onOpenChange: (open: boolean) => void
  onContinue: () => void
}
```

- [ ] **Step 1: Write failing category outcome tests**

Create `mobile/src/features/ledger/CategorySheet.test.tsx`. Mock only the queue-backed mutation boundary; render the real sheet:

```tsx
it('keeps the form open and shows a rejected category operation', async () => {
  saveCategory.mockResolvedValue(discarded('Category name is not allowed'))
  const onOpenChange = jest.fn()
  const view = await render(<CategorySheet {...baseProps} onOpenChange={onOpenChange} />)

  fireEvent.changeText(view.getByLabelText('Name'), 'Food')
  fireEvent.press(view.getByText('Save'))

  expect(await view.findByText('Category name is not allowed')).toBeTruthy()
  expect(onOpenChange).not.toHaveBeenCalledWith(false)
})

it('keeps the form open when the limit operation is rejected', async () => {
  saveCategory.mockResolvedValue({ status: 'queued', operationId: 'category' })
  saveLimit.mockResolvedValue(discarded('Monthly limit was rejected'))
  const onOpenChange = jest.fn()
  const view = await render(<CategorySheet {...baseProps} onOpenChange={onOpenChange} />)

  fireEvent.changeText(view.getByLabelText('Name'), 'Food')
  fireEvent.changeText(view.getByLabelText('Monthly limit'), '400')
  fireEvent.press(view.getByText('Save'))

  expect(await view.findByText('Monthly limit was rejected')).toBeTruthy()
  expect(onOpenChange).not.toHaveBeenCalledWith(false)
})
```

- [ ] **Step 2: Run category tests and verify RED**

Run:

```bash
cd mobile
npx jest src/features/ledger/CategorySheet.test.tsx --runInBand
```

Expected: FAIL because the sheet ignores operation outcomes and renders no error.

- [ ] **Step 3: Implement category outcome handling**

In `CategorySheet`:

- initialize new category kind from `initialKind ?? 'spending'`;
- add `error` state;
- pass every mutation result through `operationOutcomeError`;
- stop immediately and keep the sheet open when an error exists;
- call `onSaved?.(kind)` only after category and optional limit are accepted;
- apply the same outcome handling to deletion;
- render the error above the action row.

Core save sequence:

```ts
const categoryOutcome = await saveCategory(...)
const categoryError = operationOutcomeError(categoryOutcome)
if (categoryError) {
  setError(categoryError)
  return
}

if (kind === 'spending') {
  const limitOutcome = await saveLimit(...)
  const limitError = operationOutcomeError(limitOutcome)
  if (limitError) {
    setError(limitError)
    return
  }
}

onSaved?.(kind)
onOpenChange(false)
```

- [ ] **Step 4: Verify category tests GREEN**

Run:

```bash
cd mobile
npx jest src/features/ledger/CategorySheet.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Write failing prerequisite-dialog test**

Create `mobile/src/features/ledger/TransactionPrerequisiteDialog.test.tsx`:

```tsx
it('explains the Asset requirement and exposes a create action', async () => {
  const onContinue = jest.fn()
  const view = await render(
    <TransactionPrerequisiteDialog
      open
      prerequisite="asset"
      kind="income"
      onOpenChange={jest.fn()}
      onContinue={onContinue}
    />,
  )

  expect(view.getByText(/linked to a CAD Asset/)).toBeTruthy()
  fireEvent.press(view.getByText('Create Asset'))
  expect(onContinue).toHaveBeenCalledTimes(1)
})

it('offers category creation for the requested transaction kind', async () => {
  const onContinue = jest.fn()
  const view = await render(
    <TransactionPrerequisiteDialog
      open
      prerequisite="category"
      kind="spending"
      onOpenChange={jest.fn()}
      onContinue={onContinue}
    />,
  )

  expect(view.getByText(/Create a spending category/)).toBeTruthy()
  fireEvent.press(view.getByText('Create Category'))
  expect(onContinue).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 6: Run the prerequisite test and verify RED**

Run:

```bash
cd mobile
npx jest src/features/ledger/TransactionPrerequisiteDialog.test.tsx --runInBand
```

Expected: FAIL because the component does not exist.

- [ ] **Step 7: Implement the prerequisite dialog**

Implement the component as a thin non-destructive `ConfirmDialog` adapter:

```tsx
<ConfirmDialog
  open={open}
  onOpenChange={onOpenChange}
  title={prerequisite === 'asset' ? 'Add an Asset first' : `Add a ${kind} category first`}
  description={
    prerequisite === 'asset'
      ? `Every ${kind} entry must be linked to a CAD Asset so the balance updates automatically.`
      : `Create a ${kind} category before adding this entry.`
  }
  confirmLabel={prerequisite === 'asset' ? 'Create Asset' : 'Create Category'}
  destructive={false}
  onConfirm={onContinue}
/>
```

- [ ] **Step 8: Add Asset creation return flow**

Update `AssetSheet` to:

- inspect `saveAsset` with `operationOutcomeError`;
- keep the sheet open on rejection;
- call `onSaved?.()` after an accepted outcome and before closing.

Update `AssetsTab`:

```ts
useEffect(() => {
  if (!requestNewAsset) return
  openNewAsset()
  onNewAssetRequestHandled?.()
}, [requestNewAsset, onNewAssetRequestHandled])
```

Pass `onExternalAssetCreated` to the externally opened `AssetSheet`.

Update the Ledger root parameters:

```ts
type LedgerParams = {
  segment?: string
  newAsset?: string
  returnYearId?: string
  returnTransactionKind?: string
}
```

When external Asset creation completes:

```ts
router.replace({
  pathname: '/ledger/[yearId]',
  params: {
    yearId: params.returnYearId!,
    transactionKind: params.returnTransactionKind!,
  },
})
```

Clear `newAsset` as soon as `AssetsTab` consumes it so ordinary rerenders do not reopen the sheet.

- [ ] **Step 9: Make Budget transaction actions prerequisite-aware**

In the Budget screen:

1. Filter Assets to `currencyCode === HOUSEHOLD_CURRENCY`.
2. Replace the disabled action behavior with `beginTransaction(kind)`.
3. If no CAD Asset exists, open the Asset prerequisite dialog.
4. If no month category of that kind exists, open the Category prerequisite dialog.
5. Otherwise open `TransactionSheet`.
6. When category creation succeeds, keep a pending transaction kind and wait until the optimistic category is visible, then open `TransactionSheet`.
7. When the route contains `transactionKind=income|spending`, consume it once and run the same prerequisite checks.

The Asset continuation action is:

```ts
router.push({
  pathname: '/ledger',
  params: {
    segment: 'assets',
    newAsset: '1',
    returnYearId: year.id,
    returnTransactionKind: pendingKind,
  },
})
```

The Category continuation action opens `CategorySheet` with `initialKind={pendingKind}`. Remove `disabled={!canAddTransaction}` and muted opacity from both `+ Income` and `+ Spending`.

- [ ] **Step 10: Verify Task 6**

Run:

```bash
cd mobile
npx jest src/features/ledger/CategorySheet.test.tsx src/features/ledger/TransactionPrerequisiteDialog.test.tsx src/features/ledger/statements.test.ts --runInBand
git diff --check -- mobile/src/features/ledger/CategorySheet.tsx mobile/src/features/ledger/CategorySheet.test.tsx mobile/src/features/ledger/TransactionPrerequisiteDialog.tsx mobile/src/features/ledger/TransactionPrerequisiteDialog.test.tsx mobile/src/features/ledger/AssetSheet.tsx mobile/src/features/ledger/AssetsTab.tsx 'mobile/app/(tabs)/ledger/index.tsx' 'mobile/app/(tabs)/ledger/[yearId].tsx'
```

Expected: all tests PASS and no whitespace errors.

---

### Task 7: Full Verification and Continuation Ledger

**Files:**

- Modify: `docs/superpowers/progress-detail.md`
- Modify: `progress.md`

**Interfaces:**

- No new runtime interfaces.
- Records the exact test/build evidence and any remaining physical-device checks.

- [ ] **Step 1: Run all native unit tests**

Run:

```bash
cd mobile
npm test -- --runInBand
```

Expected: every Jest suite PASS with no unhandled warnings.

- [ ] **Step 2: Run static verification**

Run:

```bash
npm run typecheck
npm run lint
cd mobile && npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 3: Validate Expo dependency compatibility**

Run:

```bash
cd mobile
npx expo-doctor
```

Expected: all checks pass.

- [ ] **Step 4: Validate both native bundles**

Run:

```bash
cd mobile
ios_output="$(mktemp -d)"
android_output="$(mktemp -d)"
npx expo export --platform ios --output-dir "$ios_output"
npx expo export --platform android --output-dir "$android_output"
```

Expected: iOS and Android exports complete successfully. The temporary output directories are outside the repository.

- [ ] **Step 5: Review the complete diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors; unrelated pre-existing changes and untracked reference files remain intact.

- [ ] **Step 6: Update progress documentation**

Move detailed correction evidence to `docs/superpowers/progress-detail.md`. Keep `progress.md` concise with:

- this correction pass marked complete;
- exact passing test counts and static/export checks;
- remaining physical-device visual checks for centered headers, Calendar geometry, destructive list actions, Budget month expansion, and Asset/category prerequisite returns;
- Task 9 still blocked until the user accepts the manual correction pass.

- [ ] **Step 7: Final documentation check**

Run:

```bash
git diff --check -- progress.md docs/superpowers/progress-detail.md
```

Expected: no whitespace errors.
