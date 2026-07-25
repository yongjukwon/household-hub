# Household Hub Web Parity Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Stop after every numbered task,
> update `progress.md`, commit, and give the user a detailed report before
> continuing.

**Goal:** Repair the rebuilt web workflows and restore the approved
mobile-reference behavior for Calendar, Groceries, Ledger, Notes, and Trips
before any Expo work begins.

**Architecture:** Keep the existing mobile-first Supabase schema, versioned
operation RPC, IndexedDB command queue, React Query reads, Realtime
invalidation, route structure, and responsive shell. Correct payload adapters
at client boundaries, add server-authoritative Grocery purchase timestamps,
complete the missing Ledger presentation/workflows, and restore consistent
detail editing without reintroducing legacy page-table dependencies.

**Tech Stack:** React 19, TypeScript 6, React Router 7, TanStack Query 5,
Recharts 3, Tiptap 3, Dexie 4, Supabase Postgres/RLS/RPC/Realtime, Vitest 4,
Testing Library, pgTAP-style SQL tests, Vite 8.

## Global Constraints

- `docs/superpowers/specs/2026-07-25-web-parity-corrections-design.md`
  is the approved behavior specification.
- Calendar is the default route and navigation label; there is no Home.
- Phone web follows the supplied references; desktop keeps the left sidebar.
- All mutable household writes continue through the durable operation queue and
  `apply_household_operation`.
- Server timestamps, revisions, posting side effects, RLS, and conflicts remain
  authoritative.
- CAD remains the household Ledger/Grocery currency. Trip CAD and destination
  currencies remain separate and are never converted.
- Preserve the user's current local Supabase data. Do not run a hosted reset or
  alter hosted Supabase/Vercel/EAS state.
- Preserve unrelated untracked reference and mobile files.
- Use `/opt/homebrew/bin` first in `PATH` for Node/Supabase commands.
- Use test-driven development: write each regression test, run it and observe
  the expected failure, then write the minimum production change.
- Task 7 (Expo foundation) remains blocked until this correction pass is
  accepted.

---

## File Structure

### Shared UI and operation results

- Create `src/shell/ui/EditableTitle.tsx`: generic controlled inline title
  editor for Grocery and Trip detail pages.
- Create `src/lib/operations/outcome.ts`: convert an `EnqueueOutcome` into a
  form-visible rejection/conflict explanation without treating queued writes
  as failures.
- Create `src/test/EditableTitle.test.tsx`.
- Create `src/test/operationOutcome.test.ts`.

### Calendar

- Create `src/features/calendar/reminders.ts`: explicit UI ↔ database reminder
  mapping.
- Create `src/test/calendarMutations.test.ts`.
- Create `src/test/calendarReminders.test.ts`.
- Modify `src/features/calendar/mutations.ts`.
- Modify `src/features/calendar/useCalendarEvents.ts`.
- Modify `src/features/calendar/EventSheet.tsx`.
- Modify `src/test/CalendarScreen.test.tsx`.

### Groceries

- Create migration
  `supabase/migrations/20260725016000_grocery_purchase_dates.sql`.
- Modify `src/types/database.ts` using generated local Supabase types.
- Modify `src/features/groceries/data.ts`: checked timestamps,
  household-wide knowledge, and cheapest-five helpers/queries.
- Modify `src/features/groceries/GroceryListScreen.tsx`.
- Modify `src/features/groceries/ItemSheet.tsx`.
- Modify `src/features/groceries/mutations.ts` only where outcome handling or
  types require it.
- Modify `src/test/GroceryListScreen.test.tsx`.
- Create `src/test/groceryData.test.ts`.
- Extend `supabase/tests/20260725_mobile_first_operations.test.sql`.

### Ledger

- Create migration
  `supabase/migrations/20260725017000_ledger_default_income_categories.sql`.
- Modify `src/types/database.ts` using generated local Supabase types.
- Create `src/features/ledger/NewYearSheet.tsx`.
- Create `src/features/ledger/StatementYearList.tsx`.
- Create `src/features/ledger/StatementYearSummary.tsx`.
- Create `src/features/ledger/StatementMonthScreen.tsx`.
- Create `src/features/ledger/StatementCharts.tsx`.
- Modify `src/features/ledger/StatementsTab.tsx` to become the list-first
  annual entry surface.
- Modify `src/features/ledger/statements.ts` with pure annual/month summary
  calculations.
- Modify `src/features/ledger/TransactionSheet.tsx` to take a fixed
  `kind: 'income' | 'spending'`.
- Create `src/features/ledger/TransactionList.tsx`.
- Modify `src/features/ledger/statementMutations.ts`.
- Modify `src/App.tsx` to add `/ledger/:yearId`.
- Modify `src/test/ledgerStatements.test.ts`.
- Create `src/test/StatementsTab.test.tsx`.
- Create `src/test/StatementMonthScreen.test.tsx`.
- Extend `supabase/tests/20260725_mobile_first_operations.test.sql`.

### Notes

- Create `src/features/notes/RestrictedNoteView.tsx`: non-editable renderer for
  the restricted note document.
- Modify `src/features/notes/RestrictedEditor.tsx`: emit local document changes
  immediately to parent state without network autosave.
- Rewrite `src/features/notes/NoteScreen.tsx` around explicit read/edit states.
- Modify `src/test/NoteScreen.test.tsx`.
- Create `src/test/RestrictedNoteView.test.tsx`.

### Trips

- Modify `src/features/trips/TripSheet.tsx`: grouped destination setup,
  uppercase/validation/preview.
- Modify `src/features/trips/ExpenseSheet.tsx`: matching-Asset filtering and
  recovery link.
- Modify `src/features/trips/TripScreen.tsx`: shared title editor and outcome
  handling.
- Modify `src/test/TripScreen.test.tsx`.
- Create `src/test/TripSheet.test.tsx`.
- Create `src/test/ExpenseSheet.test.tsx`.

### Handoff

- Modify `progress.md` after each numbered task.
- Modify `docs/superpowers/progress-detail.md` only for final cross-feature
  verification evidence.

---

### Task 1: Calendar operation-contract correction

**Files:**

- Create: `src/features/calendar/reminders.ts`
- Create: `src/lib/operations/outcome.ts`
- Create: `src/test/calendarMutations.test.ts`
- Create: `src/test/calendarReminders.test.ts`
- Create: `src/test/operationOutcome.test.ts`
- Modify: `src/features/calendar/mutations.ts`
- Modify: `src/features/calendar/useCalendarEvents.ts`
- Modify: `src/features/calendar/EventSheet.tsx`
- Modify: `src/test/CalendarScreen.test.tsx`
- Modify: `progress.md`

**Interfaces:**

- Produces:

  ```ts
  export function reminderToDatabase(
    preset: ReminderPreset,
  ): 'at_time' | '10m' | '1h' | '1d' | '1w'

  export function reminderFromDatabase(
    value: string,
  ): ReminderPreset | null

  export function operationOutcomeError(
    outcome: EnqueueOutcome,
  ): string | null
  ```

- `operationOutcomeError` returns `null` for `settled` and `queued`, and the
  discard explanation for `discarded`.
- `buildEventPayload` returns a discriminated payload shape: inactive date/time
  keys are absent, not `null`.

- [x] **Step 1: Write failing payload-shape tests**

  Create `src/test/calendarMutations.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { buildEventPayload, type CalendarEventForm } from
    '@/features/calendar/mutations'

  const base: CalendarEventForm = {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: null,
    title: 'Dinner',
    note: null,
    allDay: false,
    startAt: '2026-07-25T19:00:00.000Z',
    endAt: '2026-07-25T20:00:00.000Z',
    startDate: null,
    endDate: null,
    timezone: 'America/Vancouver',
    recurrenceFrequency: 'none',
    recurrenceUntil: null,
    reminders: [],
  }

  it('omits all-day keys from a timed event', () => {
    const payload = buildEventPayload(base)
    expect(payload).toMatchObject({
      startAt: base.startAt,
      endAt: base.endAt,
    })
    expect(payload).not.toHaveProperty('startDate')
    expect(payload).not.toHaveProperty('endDate')
  })

  it('omits timed keys from an all-day event', () => {
    const payload = buildEventPayload({
      ...base,
      allDay: true,
      startAt: null,
      endAt: null,
      startDate: '2026-07-25',
      endDate: '2026-07-25',
    })
    expect(payload).toMatchObject({
      startDate: '2026-07-25',
      endDate: '2026-07-25',
    })
    expect(payload).not.toHaveProperty('startAt')
    expect(payload).not.toHaveProperty('endAt')
  })
  ```

- [x] **Step 2: Run the payload tests and verify RED**

  Run:

  ```bash
  PATH="/opt/homebrew/bin:$PATH" \
    npx vitest run src/test/calendarMutations.test.ts
  ```

  Expected: both tests fail because inactive keys currently exist with `null`
  values.

- [x] **Step 3: Implement discriminated event payload construction**

  In `src/features/calendar/mutations.ts`, build common fields once and spread
  exactly one temporal branch:

  ```ts
  const temporal = form.allDay
    ? { startDate: form.startDate, endDate: form.endDate }
    : { startAt: form.startAt, endAt: form.endAt }

  return {
    ...common,
    ...temporal,
    reminders: form.reminders.map(reminderToDatabase),
  }
  ```

  Keep `CalendarEventForm` unchanged so the form model remains explicit; only
  the command boundary becomes contract-shaped.

- [x] **Step 4: Write failing reminder-adapter tests**

  Create `src/test/calendarReminders.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest'
  import {
    reminderFromDatabase,
    reminderToDatabase,
  } from '@/features/calendar/reminders'

  it('maps the UI at-time value to the database enum', () => {
    expect(reminderToDatabase('at-time')).toBe('at_time')
  })

  it('maps the database enum back to the UI value', () => {
    expect(reminderFromDatabase('at_time')).toBe('at-time')
  })

  it('rejects an unknown stored reminder', () => {
    expect(reminderFromDatabase('tomorrow')).toBeNull()
  })
  ```

- [x] **Step 5: Run reminder tests and verify RED**

  Run:

  ```bash
  PATH="/opt/homebrew/bin:$PATH" \
    npx vitest run src/test/calendarReminders.test.ts
  ```

  Expected: module-not-found failure because the adapter does not exist.

- [x] **Step 6: Implement reminder adapters and wire reads/writes**

  Create `src/features/calendar/reminders.ts` with an exhaustive mapping:

  ```ts
  const toDatabase = {
    'at-time': 'at_time',
    '10m': '10m',
    '1h': '1h',
    '1d': '1d',
    '1w': '1w',
  } as const
  ```

  `none` is not persisted in the reminder array; reject it at
  `reminderToDatabase` or exclude it before mapping. Replace
  `isReminderPreset(r.preset)` in `useCalendarEvents.ts` with
  `reminderFromDatabase(r.preset)`.

- [x] **Step 7: Write failing operation-outcome tests**

  Create `src/test/operationOutcome.test.ts` covering:

  ```ts
  expect(operationOutcomeError({
    status: 'queued',
    operationId: OPERATION_ID,
  })).toBeNull()

  expect(operationOutcomeError({
    status: 'discarded',
    operationId: OPERATION_ID,
    discarded: {
      operationId: OPERATION_ID,
      reason: 'rejected',
      command: {
        schemaVersion: 1,
        operationId: OPERATION_ID,
        deviceId: '22222222-2222-4222-8222-222222222222',
        localSequence: 1,
        householdId: '33333333-3333-4333-8333-333333333333',
        type: 'calendar.event.upsert',
        entityType: 'calendar_event',
        entityId: '44444444-4444-4444-8444-444444444444',
        baseRevision: null,
        enqueuedAt: '2026-07-25T12:00:00.000Z',
        payload: {},
      },
      discardedAt: '2026-07-25T12:00:01.000Z',
      winner: null,
      code: 'invalid_payload',
      explanation: 'Operation payload is invalid for its type',
      details: {},
      warnings: [],
      acknowledgedAt: null,
    },
  })).toBe('Operation payload is invalid for its type')
  ```

  Do not weaken production types for the test.

- [x] **Step 8: Run outcome tests and verify RED**

  Run:

  ```bash
  PATH="/opt/homebrew/bin:$PATH" \
    npx vitest run src/test/operationOutcome.test.ts
  ```

  Expected: module-not-found failure.

- [x] **Step 9: Implement outcome handling and keep Calendar form open**

  Create `src/lib/operations/outcome.ts`. In `EventSheet.handleSave`:

  ```ts
  const outcome = await saveCalendarEvent(...)
  const outcomeError = operationOutcomeError(outcome)
  if (outcomeError) {
    setError(outcomeError)
    return
  }
  onOpenChange(false)
  ```

  Use the same rule for delete. Preserve the existing transport-error fallback.

- [x] **Step 10: Add component regression coverage**

  Extend `src/test/CalendarScreen.test.tsx` or extract an
  `EventSheet.test.tsx` if setup becomes clearer. Mock
  `saveCalendarEvent` twice:

  - discarded → the dialog remains open and explanation is visible;
  - queued → the dialog closes.

  Assert on user-visible behavior, not only mock arguments.

- [x] **Step 11: Run focused Calendar tests**

  Run:

  ```bash
  PATH="/opt/homebrew/bin:$PATH" npx vitest run \
    src/test/calendarMutations.test.ts \
    src/test/calendarReminders.test.ts \
    src/test/operationOutcome.test.ts \
    src/test/CalendarScreen.test.tsx
  ```

  Expected: all pass.

- [x] **Step 12: Perform live Calendar verification**

  With local Supabase running and signed in as `yongju@test.local`:

  1. create a timed event with no reminder;
  2. create an all-day event;
  3. create a timed event with At time and 10 minutes reminders;
  4. edit one event; and
  5. confirm no new `invalid_payload` receipt is created.

  Query:

  ```bash
  docker exec supabase_db_household-hub psql -U postgres -d postgres \
    -c "select status, result from public.operation_receipts order by created_at desc limit 5"
  ```

- [x] **Step 13: Verify, update handoff, commit, and stop**

  Run:

  ```bash
  PATH="/opt/homebrew/bin:$PATH" npx vitest run
  PATH="/opt/homebrew/bin:$PATH" npm run lint
  PATH="/opt/homebrew/bin:$PATH" npm run build
  git diff --check
  ```

  Update `progress.md` with the Calendar root cause, behavior, live evidence,
  exact test counts, commit checkpoint, and Task 2 as the resume point.

  Commit:

  ```bash
  git add src/features/calendar src/lib/operations/outcome.ts \
    src/test/calendarMutations.test.ts src/test/calendarReminders.test.ts \
    src/test/operationOutcome.test.ts src/test/CalendarScreen.test.tsx \
    progress.md
  git commit -m "fix: align Calendar operation contract"
  ```

  Stop and report Task 1. Do not begin Groceries without the user's next go
  sign.

---

### Task 2: Grocery purchase dates, knowledge, history, and title editing

**Files:**

- Create:
  `supabase/migrations/20260725016000_grocery_purchase_dates.sql`
- Create: `src/shell/ui/EditableTitle.tsx`
- Create: `src/test/EditableTitle.test.tsx`
- Create: `src/test/groceryData.test.ts`
- Modify: `src/types/database.ts`
- Modify: `src/features/groceries/data.ts`
- Modify: `src/features/groceries/GroceryListScreen.tsx`
- Modify: `src/features/groceries/ItemSheet.tsx`
- Modify: `src/features/groceries/mutations.ts`
- Modify: `src/test/GroceryListScreen.test.tsx`
- Modify: `supabase/tests/20260725_mobile_first_operations.test.sql`
- Modify: `progress.md`

**Interfaces:**

- `GroceryItem` gains `checkedAt: string | null`.
- `PriceHistoryEntry` gains `listName: string`.
- Produces:

  ```ts
  export function sortGroceryItems(items: GroceryItem[]): {
    unchecked: GroceryItem[]
    checked: GroceryItem[]
  }

  export function cheapestPriceHistory(
    history: PriceHistoryEntry[],
    normalizedName: string,
    limit?: number,
  ): PriceHistoryEntry[]

  export function groceryNameSuggestions(
    items: GroceryKnowledgeItem[],
    history: PriceHistoryEntry[],
  ): string[]
  ```

- `EditableTitle` consumes `value`, `ariaLabel`, and
  `onSave(next: string): Promise<string | null>`; `null` means success, a string
  keeps edit mode open as an error.

- [x] **Step 1: Write SQL regression tests for purchase timestamps**

  Extend the existing Grocery operation section in
  `supabase/tests/20260725_mobile_first_operations.test.sql`:

  - new unchecked item has `checked_at is null`;
  - first check sets non-null `checked_at`;
  - editing name/price while checked preserves it;
  - uncheck clears it;
  - recheck assigns a later value.

- [x] **Step 2: Run SQL tests and verify RED**

  Run:

  ```bash
  PATH="/opt/homebrew/bin:$PATH" npx supabase db reset --local
  ```

  Expected: SQL test fails because `checked_at` does not exist.

- [x] **Step 3: Add the schema field and server-derived trigger**

  Migration:

  ```sql
  alter table public.household_grocery_items
    add column checked_at timestamptz;

  create function public.mobile_set_grocery_checked_at()
  returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
  begin
    if new.checked and (tg_op = 'INSERT' or not old.checked) then
      new.checked_at := clock_timestamp();
    elsif not new.checked then
      new.checked_at := null;
    end if;
    return new;
  end;
  $$;

  create trigger trg_mobile_grocery_checked_at
    before insert or update of checked
    on public.household_grocery_items
    for each row execute function public.mobile_set_grocery_checked_at();
  ```

  Make the trigger idempotent within the migration and do not accept
  client-supplied timestamps.

- [x] **Step 4: Reset locally, rerun SQL tests, regenerate types**

  Run:

  ```bash
  PATH="/opt/homebrew/bin:$PATH" npx supabase db reset --local
  PATH="/opt/homebrew/bin:$PATH" npx supabase gen types typescript --local \
    > /tmp/household-hub-database.ts
  ```

  Replace `src/types/database.ts` using the generated file as a formatting
  command output, not by hand. Reseed the two local test accounts afterward
  using the exact command documented in `progress.md`.

- [x] **Step 5: Write pure-data tests and verify RED**

  Create `src/test/groceryData.test.ts` with:

  ```ts
  expect(sortGroceryItems([
    item({ name: 'Older', checked: true, checkedAt: '2026-07-20T00:00:00Z' }),
    item({ name: 'Newer', checked: true, checkedAt: '2026-07-25T00:00:00Z' }),
  ]).checked.map((item) => item.name)).toEqual(['Newer', 'Older'])

  expect(cheapestPriceHistory(history, 'eggs')).toEqual([
    expect.objectContaining({ priceCents: 349 }),
    expect.objectContaining({ priceCents: 398 }),
    expect.objectContaining({ priceCents: 429 }),
    expect.objectContaining({ priceCents: 449 }),
    expect.objectContaining({ priceCents: 499 }),
  ])
  ```

  Add household-wide suggestion dedupe/casing tests.

- [x] **Step 6: Implement Grocery data queries/helpers**

  Query items with `checked_at`. Query household-wide price history joined to
  `household_grocery_lists(name)`, not restricted to active `list_id`, and
  order/filter the selected item's cheapest five in the pure helper. Add a
  household-wide current-name query or return the needed knowledge with a
  separate `useGroceryKnowledge` hook so opening one list can suggest names
  known in another.

- [x] **Step 7: Write EditableTitle tests and verify RED**

  Cover activation, Enter/blur save, Escape cancel, blank rejection, pending
  disabling, and an `onSave` error that remains visible.

- [x] **Step 8: Implement EditableTitle**

  Use a real heading plus button in read state and a same-size input in edit
  state. Ensure blur caused by clicking Cancel does not save first. Expose
  status/errors accessibly.

- [x] **Step 9: Extend Grocery screen tests and verify RED**

  Cover:

  - list rename through `saveGroceryList` with the loaded revision;
  - household-wide autocomplete menu and selecting a suggestion;
  - checked purchase date display and newest-first order;
  - item activation opening five cheapest history rows;
  - list/store names and dates in history; and
  - clear checked retaining the history display contract.

- [x] **Step 10: Implement Grocery UI**

  Replace the static title with `EditableTitle`. Restore a keyboard-accessible
  combobox using the approved legacy interaction pattern without importing
  legacy hooks/tables. Add purchase-date metadata and an item-scoped
  cheapest-five history card styled to the reference.

- [x] **Step 11: Run focused and full verification**

  Run SQL reset/tests, focused Grocery tests, full Vitest, lint, build, and
  `git diff --check`. Live verify with more than five price records and two
  lists.

- [x] **Step 12: Update handoff, commit, and stop**

  Commit migration, generated types, Grocery/shared UI/tests, and
  `progress.md`:

  ```bash
  git commit -m "feat: restore Grocery parity workflows"
  ```

  Stop before Task 3.

---

### Task 3: Ledger annual/monthly UI, year creation, and visible transactions

**Files:**

- Create:
  `supabase/migrations/20260725017000_ledger_default_income_categories.sql`
- Create: `src/features/ledger/NewYearSheet.tsx`
- Create: `src/features/ledger/StatementYearList.tsx`
- Create: `src/features/ledger/StatementYearSummary.tsx`
- Create: `src/features/ledger/StatementMonthScreen.tsx`
- Create: `src/features/ledger/StatementCharts.tsx`
- Create: `src/features/ledger/TransactionList.tsx`
- Create: `src/test/StatementsTab.test.tsx`
- Create: `src/test/StatementMonthScreen.test.tsx`
- Modify: `src/types/database.ts`
- Modify: `src/features/ledger/StatementsTab.tsx`
- Modify: `src/features/ledger/statements.ts`
- Modify: `src/features/ledger/TransactionSheet.tsx`
- Modify: `src/features/ledger/statementMutations.ts`
- Modify: `src/test/ledgerStatements.test.ts`
- Modify: `src/App.tsx`
- Modify: `supabase/tests/20260725_mobile_first_operations.test.sql`
- Modify: `progress.md`

**Interfaces:**

- Produces pure calculations:

  ```ts
  export interface StatementTotals {
    incomeCents: number
    spendingCents: number
    limitCents: number
    leftCents: number
    utilization: number | null
  }

  export function statementTotals(
    data: LedgerYearData,
    monthId?: string,
  ): StatementTotals

  export function spendingCategoryTotals(
    data: LedgerYearData,
    monthId?: string,
  ): Array<{ categoryId: string; name: string; totalCents: number }>

  export function monthlyBudgetLimits(
    data: LedgerYearData,
  ): Array<{ month: number; limitCents: number }>
  ```

- `/ledger` renders annual Statement rows; `/ledger/:yearId` renders monthly
  detail.
- `TransactionSheet` receives fixed `kind` and never asks the user to switch
  kinds inside the form.

- [x] **Step 1: Add failing SQL tests for default income categories**

  Assert a newly created year has 12 months and exactly these six system keys
  represented in every month: `salary`, `bonus`, `rrsp`, `tfsa`, `espp`,
  `government_benefit`. Assert an existing year backfill does not duplicate
  categories and preserves custom categories.

- [x] **Step 2: Run SQL tests and verify RED**

  Reset local Supabase; expect missing default-category assertions.

- [x] **Step 3: Implement default-category creation/backfill**

  Add a forward migration that:

  1. defines one helper for ensuring the six categories and their
     `ledger_month_categories`;
  2. calls it atomically from the `ledger.year.upsert` operation path;
  3. records required entity revisions so later category operations work;
  4. backfills existing local/hosted years by stable `system_key`; and
  5. never deletes or renames custom categories.

  Because `apply_household_operation` is versioned in SQL, copy the canonical
  function body into the forward migration and change only the
  `ledger.year.upsert` branch plus its helper call. Apply the same canonical
  change to the baseline migration only if the repository's migration
  verification requires reset equivalence; document both hashes in the task
  report.

- [x] **Step 4: Reset, test, regenerate types, and reseed**

  Run local reset/SQL suite, regenerate `src/types/database.ts`, and recreate
  the two test accounts. Verify the current 2026 year receives only missing
  defaults.

- [x] **Step 5: Write pure calculation tests and verify RED**

  Extend `src/test/ledgerStatements.test.ts` with:

  - annual actual income/spending;
  - monthly actuals;
  - monthly limit as the sum of spending limits only;
  - left and utilization including zero-limit behavior;
  - annual category totals; and
  - twelve monthly budget-limit bars.

- [x] **Step 6: Implement calculation helpers**

  Keep all chart numbers derived from `LedgerYearData`; chart components must
  receive already-calculated values and contain no business rules.

- [x] **Step 7: Write year-list/year-creation component tests**

  Cover:

  - newest-first year rows;
  - independent annual expand/collapse;
  - navigation to `/ledger/:yearId`;
  - `+ Year` opening a year input;
  - existing year prevented locally with `2026 already exists`; and
  - successful 2027 submission using a fresh entity UUID.

- [x] **Step 8: Build list-first Statements UI and NewYearSheet**

  Follow the reference: each row has chart-toggle and detail-chevron controls.
  Move the add action into the active Statements segment rather than a global
  Ledger action.

- [x] **Step 9: Write monthly-detail tests**

  Cover month navigation/picker, totals, chart labels/text equivalents,
  Spent/Limit/Left values, category progress, separate Income/Spending actions,
  filtered categories, transaction lists, edit, and delete.

- [x] **Step 10: Build monthly detail and charts**

  Use Recharts `PieChart`/`Pie` for donuts and semantic CSS bars for monthly
  limits/category progress. Render textual totals alongside every chart. Add
  the `/ledger/:yearId` route.

- [x] **Step 11: Split transaction workflows**

  Replace the generic `Add transaction` action with `+ Income` and
  `+ Spending`. Add transaction lists and reuse `saveTransaction` for create
  and edit with correct revisions. Inspect every `EnqueueOutcome`; keep a form
  open on discarded outcomes.

- [x] **Step 12: Verify posting behavior live**

  Create income and spending against a CAD Asset; verify:

  - Asset balance credits/debits;
  - annual/month totals and charts update;
  - edit reverses/reapplies;
  - delete reverses;
  - duplicate-year submission never enters the queue; and
  - server concurrent uniqueness remains tested.

- [x] **Step 13: Run full checks, update handoff, commit, and stop**

  Run SQL reset/tests, Vitest, lint, build, and diff check. Commit:

  ```bash
  git commit -m "feat: complete Ledger statement workflows"
  ```

  Stop before Task 4.

---

### Task 4: Notes read mode and explicit editing

**Files:**

- Create: `src/features/notes/RestrictedNoteView.tsx`
- Create: `src/test/RestrictedNoteView.test.tsx`
- Modify: `src/features/notes/RestrictedEditor.tsx`
- Modify: `src/features/notes/NoteScreen.tsx`
- Modify: `src/test/NoteScreen.test.tsx`
- Modify: `progress.md`

**Interfaces:**

- `RestrictedNoteView` consumes `document: RichNoteDocument` and renders only
  the approved node types.
- `RestrictedEditor` remains controlled by `content` and calls
  `onChange(document)` to update local draft state; it performs no network
  save.

- [ ] **Step 1: Write read-renderer tests and verify RED**

  Test paragraphs, heading levels 1–3, bullet/ordered lists, task-list checked
  states, empty documents, and rejection-safe rendering of an unknown node.

- [ ] **Step 2: Implement RestrictedNoteView**

  Prefer a recursive, exhaustively typed renderer over instantiating a second
  editor. Apply the existing `hh-note-content` styles to read output and use
  disabled semantic checkboxes for task items.

- [ ] **Step 3: Rewrite NoteScreen tests for read/edit/save/cancel**

  Assert:

  - initial read mode has no toolbar/title textbox;
  - Edit opens title plus editor;
  - title activation also enters edit mode with title focus;
  - Cancel restores saved title/document and performs no mutation;
  - Save sends one `note.upsert`;
  - discarded Save stays in edit mode with explanation;
  - queued Save returns to read mode; and
  - delete behavior remains confirmed.

- [ ] **Step 4: Run tests and verify RED**

  Expected: current always-editor behavior fails the read-mode assertions.

- [ ] **Step 5: Implement explicit draft state**

  Keep `saved` from the query and local `{ title, document }` draft only while
  editing. Remove title-on-blur and debounced network saves. Save once using the
  loaded revision, inspect outcome, and return to read mode only for queued or
  settled outcomes.

- [ ] **Step 6: Verify formatting and persistence live**

  Exercise body, H1–H3, bullet, numbered, checklist, undo, redo, Save, Cancel,
  reload, and partner read visibility.

- [ ] **Step 7: Run full checks, update handoff, commit, and stop**

  Commit:

  ```bash
  git commit -m "feat: add Notes read and explicit edit modes"
  ```

  Stop before Task 5.

---

### Task 5: Trip destination-currency and compatible-Asset workflow

**Files:**

- Modify: `src/features/trips/TripSheet.tsx`
- Modify: `src/features/trips/ExpenseSheet.tsx`
- Modify: `src/features/trips/TripScreen.tsx`
- Modify: `src/test/TripScreen.test.tsx`
- Create: `src/test/TripSheet.test.tsx`
- Create: `src/test/ExpenseSheet.test.tsx`
- Modify: `progress.md`

**Interfaces:**

- Produces:

  ```ts
  export function normalizeCurrencyInput(value: string): string

  export function compatibleExpenseAssets(
    assets: LedgerAsset[],
    currency: string,
  ): LedgerAsset[]
  ```

- Currency input accepts a manually typed validated uppercase ISO code.

- [ ] **Step 1: Write Trip form tests and verify RED**

  Cover uppercase normalization, invalid length/code, grouped
  city/timezone/currency labels, preview text, existing-trip editing, and a
  discarded outcome retaining the form.

- [ ] **Step 2: Implement destination setup**

  Keep the current common timezone suggestions, require a manual three-letter
  currency, uppercase while typing, validate via the shared
  `isCurrencyCode`, and render preview:

  ```text
  London · Europe/London · GBP
  ```

- [ ] **Step 3: Write ExpenseSheet filtering tests and verify RED**

  Given CAD and GBP Assets:

  - GBP selection lists only GBP Assets;
  - CAD selection lists only CAD Assets;
  - selected Asset resets when currency changes;
  - no match disables Save and displays a Ledger Assets recovery link; and
  - the currency choices are exactly CAD plus destination currency, deduped.

- [ ] **Step 4: Implement filtered Asset workflow**

  Filter before rendering options. Never send a known currency mismatch. Add a
  link to `/ledger?segment=assets`; update `LedgerScreen` to respect this query
  parameter only if not already supported.

- [ ] **Step 5: Add inline Trip title editing**

  Use `EditableTitle` with `saveTrip`, preserving all non-title Trip fields and
  the loaded revision. Keep the existing full Edit control for destination
  setup.

- [ ] **Step 6: Verify CAD and foreign expenses live**

  For a GBP Trip with CAD and GBP Assets:

  - add one CAD expense and one GBP expense;
  - verify separate totals;
  - verify each matching Asset debit;
  - verify only CAD creates a Travel Ledger transaction; and
  - verify changing currency after foreign spending retains the existing
    server lock.

- [ ] **Step 7: Run full checks, update handoff, commit, and stop**

  Commit:

  ```bash
  git commit -m "feat: clarify Trip currency expense flow"
  ```

  Stop before Task 6.

---

### Task 6: Cross-feature reference verification and final handoff

**Files:**

- Modify: `progress.md`
- Modify: `docs/superpowers/progress-detail.md`
- Add screenshot artifacts only if the repository's existing screenshot policy
  tracks them; otherwise keep them as local verification evidence.

**Interfaces:**

- Consumes Tasks 1–5.
- Produces the final web-correction acceptance record and exact pre-Expo resume
  point.

- [ ] **Step 1: Reset/reseed a disposable local verification database**

  Verify the Supabase URL is loopback before reset. Run migrations/tests, then
  seed Yongju and Claire through the documented onboarding/invite path.

- [ ] **Step 2: Execute the complete behavioral matrix**

  Verify every end-to-end scenario listed in the approved design using both
  accounts and network offline/reconnect simulation. Confirm rejected commands
  are explained and permanently discarded.

- [ ] **Step 3: Capture phone and desktop reference comparisons**

  Check all supplied screen states at reference-sized phone width and desktop
  sidebar width. Compare typography, spacing, cards, segment controls, chart
  composition, bottom navigation, header actions, fixed-bottom overlap, empty
  states, and long-content scrolling.

- [ ] **Step 4: Run complete automated verification**

  ```bash
  PATH="/opt/homebrew/bin:$PATH" npx vitest run
  PATH="/opt/homebrew/bin:$PATH" npm run lint
  PATH="/opt/homebrew/bin:$PATH" npx tsc -b --pretty false
  PATH="/opt/homebrew/bin:$PATH" npm run build
  PATH="/opt/homebrew/bin:$PATH" npx supabase db reset --local
  PATH="/opt/homebrew/bin:$PATH" npx supabase db lint --local
  git diff --check
  ```

- [ ] **Step 5: Update canonical documentation**

  Record:

  - task commits and exact final HEAD;
  - migration names;
  - test counts;
  - browser/device evidence;
  - any explicitly accepted residual gaps;
  - preserved local test credentials;
  - web-correction acceptance state; and
  - Task 7 as the next step only after user approval.

- [ ] **Step 6: Commit and stop**

  ```bash
  git commit -m "docs: complete web parity correction handoff"
  ```

  Give the user the final web correction report. Do not start Expo until the
  user explicitly approves the completed web result.
