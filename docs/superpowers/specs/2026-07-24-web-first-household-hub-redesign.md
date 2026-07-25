# Household Hub Web-First Redesign and Native Parity

**Status:** Approved design

## Goal

Replace the current web experience with the approved Household Hub visual system and mobile-first product architecture, validate it on web, then build iOS and Android clients against the same backend contracts.

## Product surface

- The web app is the first full implementation and behavioral testbed. Phone web follows the design reference; desktop retains a wide layout with a left navigation pane.
- The five primary destinations are **Calendar**, **Groceries**, **Ledger**, **Notes**, and **Trips**. Calendar is the default. Home is removed.
- The persistent header contains the rabbit/penguin mark, notification inbox, and Settings. Phone web and native use the floating five-tab bar; desktop uses the left pane.
- The visual system uses Pretendard, `#EFEFF2` canvas, `#14151A` ink, `#FF7A45` accent, the supplied data palette, white 16–24px-radius cards, soft shadows, and Heroicons.
- Groceries, Ledger, and Trips are list-to-detail flows. Forms use bottom sheets when short, full-screen modal pages when rich, and explicit destructive confirmations.

## Identity, household, and settings

- Production authentication supports Google and Apple only. Development retains the existing password test accounts in a test-only flow that is excluded from production builds.
- The first OAuth user creates a household and becomes its owner. The owner shares a seven-day, one-time invite link or code. A household has at most two active members.
- Settings includes appearance (light, dark, system), notification settings, account identity, ownership transfer, invite regeneration/revocation, partner removal, sign-out, account deletion, and household deletion.
- A non-owner can delete their account and leave the household. An owner must transfer ownership or delete the household first.
- Production starts with no application data or legacy household. Legacy user content is cleared at cutover; existing password accounts remain only for development/test use.

## Ledger and Assets

- Ledger has separate Statements and Assets controls, each with its own add action; there is no global Ledger add action.
- Statements list years directly. Creating a year creates all twelve monthly budget components.
- A month inherits the most recent prior month’s category and limit configuration. Additions, limit changes, and removals propagate from the selected month to the end of that year; earlier months never change.
- A category cannot be removed when the selected or any later affected month contains spending. The warning identifies blocking months. A populated year can only be removed through a typed-year **Clear all and delete year** confirmation that deletes only that year’s income, spending, categories, and limits.
- Spending categories carry limits. Income categories are Salary, Bonus, RRSP, TFSA, ESPP, Government benefit, plus custom categories; income categories have no limits.
- Every income and spending transaction requires an Asset source. Income credits that Asset, spending debits it, and edits/deletions reverse and reapply the balance atomically.
- Asset-to-Asset transfers are not income or spending. Negative balances remain allowed but show a warning.
- Assets are fully manual. CAD Asset balances form the household total; foreign-currency cash Assets remain visible individually but are excluded from that total. No bank connections, imports, market feeds, or currency conversion are included.
- Recurring transfers support weekly, biweekly, semi-monthly, and monthly schedules and move value only between Assets.

## Calendar, Notes, Groceries, and Trips

- Calendar stores each timed event’s timezone and UTC instant. Timed events display in the viewing device’s timezone; all-day events keep their calendar date. New events default to the device timezone and offer a manual selector.
- Calendar supports existing timed, all-day, multi-day, and whole-series recurrence. Each event supports multiple reminder presets. All-day reminders default to 9:00 AM in the event timezone.
- Calendar sends push and in-app inbox notifications for reminders and partner-only create, update, and delete activity. Read inbox items expire after 90 days; unread items remain until opened.
- Notes use TenTap with body text, Heading 1–3, bullet lists, numbered lists, checklists, undo, and redo.
- Groceries remain CAD-only with list-level price history and the reference list-to-detail flow.
- Trips store a destination timezone so itinerary times always remain local to the trip destination. Trips retain Itinerary, Bookings, and Checklist, and add **Expenses** as the final tab.
- Trip expenses link to the Asset used to pay. CAD expenses automatically create the corresponding Ledger Travel spending entry. Foreign-currency expenses reduce the matching foreign-currency Asset and remain outside CAD Ledger totals.
- Trip totals show separate unconverted buckets, such as CAD `$5,309` and GBP `£2,409`. Users create foreign cash Assets when exchanging currency and manually enter a CAD Ledger expense when they want the CAD budget to reflect that cash use.

## Data architecture and offline behavior

- New mobile-first Supabase tables are added beside the legacy page-based web tables; legacy tables remain available until the legacy application is retired.
- Shared domain contracts define validation, identifiers, query keys, mutation operations, calendar/ledger calculations, error results, and notification payloads for web and native clients.
- Every read is locally cached and every write is optimistic, durable, and usable offline. Web uses IndexedDB; native uses SQLite.
- Queued mutations are ordered locally, then serialized authoritatively by the server when connected. The first valid mutation applies. A later conflicting mutation is discarded and produces a detailed explanation of the failed action, the winning action, and the affected item. Stopped mutations are not retried or edited.
- Server-side operations are idempotent and transactional; RLS and server validation remain the household security boundary. Supabase Edge Functions manage invite redemption, push delivery, reminder scheduling, and notification persistence.

## Delivery and acceptance

- Web is built and validated first at phone and desktop layouts. The desktop layout retains the left pane; phone layout follows the reference design.
- Expo SDK 57 is the native target. iOS and Android are phone-only portrait apps, tested through TestFlight and Google Play internal testing before public release.
- The app uses Expo development builds, not Expo Go, for notifications and native modules.
- Required verification covers unit and component tests, database/RLS tests, queue/reconnect/conflict tests, two-user Realtime tests, notification/reminder tests, responsive web checks, iOS and Android device checks, and clean production builds.

## Explicit exclusions

- Home destination, bank connections, imports, market feeds, automatic currency conversion, tablet layouts, and recurring income/spending rules are not included.
- Foreign-currency Trip expenses do not automatically convert into CAD Ledger totals.
