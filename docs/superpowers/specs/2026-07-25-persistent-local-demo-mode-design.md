# Persistent Local Demo Mode

## Purpose

Let a developer run the web app locally and immediately use a populated,
realistic Household Hub household without manually completing a login form.
The demo must use the real local Supabase backend so that RLS, household
membership, Realtime, the durable operation queue, and financial posting rules
are exercised exactly as they are in the product.

## Scope and boundary

This is a development-only web workflow. It precedes the Expo foundation
(Task 7) and is separate from the required web UI-fidelity correction pass.

It does not:

- change production authentication, which remains Google and Apple OAuth only;
- introduce anonymous or mock authentication;
- reset local data automatically; or
- expose test credentials in a production build.

## User workflow

`npm run demo` must:

1. Ensure the local Supabase stack is available, reporting the exact recovery
   command if it is not.
2. Ensure the named two-member demo household and its sample records exist.
   This step is idempotent: it creates only missing demo records and never
   overwrites edits made in a prior demo run.
3. Start the Vite development server with a development-only automatic
   sign-in flag enabled.
4. Open the app as the primary demo member without displaying a login form.

On later launches, the saved Supabase session is reused. If browser storage has
been cleared or the saved session has expired, the app silently signs in again
as that primary member. The session is a real password-auth session against
the local Supabase stack.

The default identity is the household owner. A development-only account switcher
in Settings lets a developer sign in as the seeded partner for two-member,
notification, and conflict testing. It is omitted from non-development builds.

## Data model and seeding

The current `scripts/seed-household.ts` remains the authority for creating the
two auth users and their household membership through the real onboarding and
invite-redemption flows. A dedicated demo seeder extends it with deterministic
sample records using supported household operations.

The initial data set is representative rather than disposable:

- Calendar events across timed, all-day, shared, and reminder states.
- Two grocery lists, checked and unchecked items, and CAD price history.
- Ledger years, all twelve months, income/spending categories and limits,
  transactions, CAD and foreign Assets, transfers, and recurring transfers.
- Several named Notes using only the restricted rich-note JSON schema.
- Trips with separate CAD and destination-currency expenses.

The demo seeder must only write data that the current schema and operation
contract support. It must be extended alongside the web UI correction work to
seed Itinerary, Bookings, and Checklist content when those mobile-first tables
and operations are implemented.

Manual edits persist across `npm run demo`, browser restarts, and local service
restarts. The only destructive action is `npm run demo:reset`, which explicitly
rebuilds the demo household after displaying a clear warning. Existing generic
test fixtures and production data are never targets of this command.

## Build-time safeguards

Automatic sign-in is enabled only when all of these are true:

- `import.meta.env.DEV` is true;
- `VITE_AUTO_LOGIN_DEMO=true` is provided by the demo command; and
- the target Supabase URL is a local loopback URL.

The application must reject the flag in production, preview, or non-loopback
environments. Test account credentials are read from local-only environment
variables; `.env.example` documents variable names but contains no credentials.
The existing `VITE_DISABLE_AUTH` escape hatch is removed so the shell cannot
run without a session.

## Components and responsibilities

| Component | Responsibility |
| --- | --- |
| `demo` npm command | Orchestrates local stack check, idempotent seed, demo environment, and Vite. |
| Demo seed script | Creates missing sample records without changing existing demo edits. |
| Auth bootstrap | Reuses a valid session or silently signs in the configured local demo account. |
| Development Settings section | Shows current demo identity and lets the developer switch to the partner. |
| Reset command | Requires an explicit destructive command and rebuilds only the demo household. |

## Failure handling

- If local Supabase is unavailable, `npm run demo` exits before Vite starts and
  reports the local-start command.
- If the primary demo account or household cannot be seeded, it exits with the
  failing step; it does not fall back to an unauthenticated shell.
- If automatic sign-in fails in the browser, the normal local test-account
  sign-in screen is shown with a concise recovery message.
- If account switching fails, the current valid session remains active.

## Verification

- A fresh local database: `npm run demo` provisions data and opens Calendar as
  the owner without manual login.
- Restarting Vite, the browser, and local Supabase preserves manually edited
  demo records.
- Clearing browser storage causes one silent local sign-in and returns to the
  same household.
- The partner switcher changes the signed-in identity and household data remains
  visible under RLS.
- Production build rejects demo automatic sign-in and contains no test
  credentials.
- `npm run demo:reset` changes only the named local demo household after the
  destructive confirmation.

## Sequencing

1. Implement and verify persistent local demo mode.
2. Reopen and complete the web UI-fidelity correction pass, using the populated
   demo data for reference comparisons.
3. Begin Task 7, the Expo application foundation. Task 8 then implements the
   mobile feature and visual parity on top of that foundation.
