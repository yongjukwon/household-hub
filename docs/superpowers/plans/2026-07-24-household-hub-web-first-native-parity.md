# Household Hub Web-First Rebuild and Native Parity

## Goal

Rebuild the web app around the approved mobile visual system and new domain
model, validate it at phone and desktop widths, then build phone-only iOS and
Android clients against the same Supabase contracts.

## Global constraints

- Calendar is the default destination. The five destinations are Calendar,
  Groceries, Ledger, Notes, and Trips. There is no Home destination.
- Phone web and native follow the supplied mobile reference. Desktop keeps a
  wider left navigation pane with the same data and behavior.
- The persistent header contains the rabbit/penguin mark, notifications, and
  Settings.
- Use Pretendard, `#EFEFF2` canvas, `#14151A` ink, `#FF7A45` accent, the
  supplied data palette, soft white cards, and Heroicons.
- Notes retain multiple named documents and allow only body, Heading 1-3,
  bullet lists, numbered lists, checklists, undo, and redo.
- Money is stored as integer cents. Identifiers are UUIDs. Currencies are ISO
  codes. Timezones are IANA names. Mutable entities carry integer revisions.
- CAD contributes to household Ledger and Asset totals. Foreign currencies
  remain visible separately and are never automatically converted.
- All client writes use the durable operation queue. The first valid server
  operation wins; later conflicts are permanently discarded with a detailed
  warning.
- Keep legacy page tables temporarily, but the rebuilt clients must not read
  or write them.
- Production authentication is Google and Apple only. Email/password remains
  available only in local/test builds.
- Native application identifier is `com.conlegs.householdhub`; native targets
  portrait phones only.
- Do not execute the production data reset. Deliver the audited reset
  procedure and require a separate release-time approval to run it.
- Use test-driven development for behavior changes: record a focused failing
  test before production code, then make it pass and run the affected suite.

### Task 1: Shared foundation and domain contracts

Create the internal `@household-hub/domain` workspace package and wire both the
web root and `mobile/` package to consume it. Add pure TypeScript contracts and
validation for UUIDs, cents, currencies, timezones, revisions, rich-note JSON,
query keys, operation commands, operation results, money formatting, calendar
time behavior, and trip currency buckets. Add focused unit tests for validation
boundaries and calculations. Update package/workspace and TypeScript/Metro/Vite
configuration without moving React UI into the shared package.

### Task 2: Supabase mobile-first schema and authoritative operation RPC

Add ordered migrations beside the legacy schema for profiles/invites,
assets/postings/transfers/schedules, Ledger years/months/categories/limits/
transactions, notes, grocery lists/items/price history, Calendar reminders and
notifications, standalone trips and expenses, operation receipts, revisions,
tombstones, and change logs. Extend existing household/member and Calendar
tables where appropriate rather than duplicating identity.

Implement `apply_household_operation(command jsonb)` with:

- household authorization and per-household transaction serialization;
- operation-id idempotency;
- revision conflicts returning `applied`, `duplicate`, or `conflict`;
- atomically balanced Asset postings for Ledger and Trip mutations;
- negative-balance warnings without blocking;
- forward-to-December category/limit propagation;
- deletion blocking when selected/later months have spending;
- typed-year scoped deletion;
- CAD Trip expense auto-creation of Statement, unbudgeted Travel category,
  Asset debit, and linked Ledger row;
- foreign Trip expense Asset debit without CAD Ledger entry.

Add RLS/read policies, deny direct client writes to new mutable tables, grant
the RPC safely, update Realtime publications, and add database integration
tests for all security and transaction invariants.

### Task 3: Identity, notifications, scheduled jobs, and deployment config

Implement Google and Apple OAuth entry points for web and native callback
contracts. Keep password login behind both a development check and explicit
test-auth flag. Implement owner onboarding, seven-day one-use invite,
two-member cap, revoke/regenerate, transfer ownership, member removal, account
deletion, and household deletion.

Add Edge Functions and tests for invite administration, push dispatch,
Calendar reminder scheduling, recurring Asset transfer execution, and
notification cleanup. Support reminder presets none/at-time/10m/1h/1d/1w;
all-day reminders default to 09:00 in the event timezone. Calendar activity
notifications go only to the partner; read inbox items expire after 90 days.

Update Supabase config, environment examples, local seed fixtures, generated
database types, Vercel rewrite/cache configuration, Expo app identity/scheme,
EAS build profiles, and deployment documentation. Commit no provider secrets.

### Task 4: Durable web operation queue

Replace the generic web outbox with the shared command contract. Persist
commands, device ID, local FIFO sequence, optimistic state, attempts, and
conflict records in IndexedDB. Replay FIFO on reconnect, remove applied and
duplicate commands, discard conflicts permanently, and expose a detailed
failed/winning action explanation. Reconcile Realtime invalidations without
overwriting local optimistic overlays. Add tests for offline CRUD, reconnect,
deduplication, two-device ordering, conflict discard, and recovery after
reload.

### Task 5: Responsive web shell and visual system

Replace the current navigation and theme with routes `/calendar`,
`/groceries`, `/ledger`, `/notes`, `/trips`, `/notifications`, and `/settings`;
redirect `/` to Calendar. Implement the reference phone header/floating tab bar
and a desktop left pane at wide widths. Add shared cards, segmented controls,
bottom sheets, full-screen modal routes, destructive confirmations, loading,
empty, offline-pending, conflict, and error states. Implement Light, Dark, and
System appearance using semantic tokens. Add component, accessibility, and
responsive screenshot tests.

### Task 6: Web feature flows

Implement and test:

- Calendar month grid, selected-day list, timed/all-day/multiday recurrence,
  event timezone/UTC storage, device-timezone display, reminders, edits,
  partner notifications, and notification deep links.
- Grocery list index/detail, checked items, CAD price input, immutable price
  history, and destructive confirmations.
- Ledger Statements/Assets segmented controls with separate add actions,
  expandable year/month summaries derived from transactions, the 4x3 month
  picker, category progress, Asset management, transfers, recurring transfer
  controls, deletion guards, and typed-year clear-all.
- Named Notes list with create/rename/delete and a restricted Tiptap editor
  compatible with native TenTap JSON.
- Trip list/detail with fixed destination timezone, Itinerary, Bookings,
  Checklist, and rightmost Expenses tab. Totals display separate CAD and
  destination-currency buckets without conversion.
- Settings for appearance, notification preferences, account identity,
  household/invite/ownership actions, sign-out, and destructive account/
  household actions.

Remove rebuilt routes' dependencies on legacy `pages`, `budget_*`,
`savings_*`, and old page-template hooks while leaving legacy tables in place.

### Task 7: Expo application foundation and offline data layer

Replace the Expo scaffold with Expo Router, shared domain package consumption,
Supabase session storage, OAuth/deep links, SQLite query cache and durable
operation queue, secure device/session identifiers, Realtime reconciliation,
and Expo Notifications. Configure `householdhub://` callbacks,
`com.conlegs.householdhub`, portrait-only phones, system appearance, iOS and
Android development builds, and EAS profiles. Add Jest/React Native Testing
Library coverage for navigation, queue persistence/replay/conflicts,
authentication gates, deep links, timezone helpers, and currency presentation.

### Task 8: Expo feature parity and visual implementation

Implement the same five tabs, header actions, detail stacks, modal/bottom-sheet
flows, design tokens, validation, optimistic behavior, and server operations as
web. Use Heroicons, React Native SVG, and TenTap. Implement Calendar,
Groceries, Ledger/Assets, multiple Notes, Trips/Expenses, notification inbox,
and Settings at phone portrait sizes. Validate against the supplied references
on iPhone and Android development builds and add focused component tests.

### Task 9: Reset procedure, end-to-end verification, and release handoff

Add an audited, idempotent administrator-only reset procedure that deletes
public application and legacy household data while preserving `auth.users`.
Test its exact scope locally; do not run it against production.

Add Playwright phone/desktop flows and complete database, queue, two-user
Realtime, OAuth contract, notification, reminder, and native test coverage.
Run lint, typecheck, all web tests, production web build, local Supabase reset
and database tests, native tests/typecheck, and clean iOS/Android development
build validation. Document remaining external credential and physical-device
release checks for TestFlight and Google Play internal testing.
