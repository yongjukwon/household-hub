# Mobile-first rollout — deployment reference

Deployment steps for the rebuilt Household Hub (mobile-first schema, Edge
Functions, OAuth, Expo clients). It covers what the rebuild adds; the existing
[`DEPLOYMENT.md`](../../DEPLOYMENT.md) still describes the Vercel/Supabase
basics for the legacy web app.

**No secrets belong in this repository.** Every value below is set through a
provider dashboard, `supabase secrets set`, or an EAS environment variable.

---

## 1. Environment variables

| Name                                                       | Where it lives                         | Notes                                                                                                              |
| ---------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`                                        | Vercel project env, `.env.local`       | Public                                                                                                             |
| `VITE_SUPABASE_ANON_KEY`                                   | Vercel project env, `.env.local`       | Public; RLS is the boundary                                                                                        |
| `VITE_ENABLE_TEST_AUTH`                                    | `.env.local` only                      | Password sign-in; a production build ignores it (`isPasswordAuthAllowed` requires non-production **and** the flag) |
| `EXPO_PUBLIC_SUPABASE_URL` / `..._ANON_KEY`                | `mobile/.env.local`, EAS env           | Embedded in the app bundle                                                                                         |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                | shell, for `scripts/seed-household.ts` | Never in a file                                                                                                    |
| `SUPABASE_AUTH_EXTERNAL_{GOOGLE,APPLE}_{CLIENT_ID,SECRET}` | shell, for the local stack             | Hosted equivalents live in the Supabase dashboard                                                                  |
| `EXPO_ACCESS_TOKEN`                                        | `supabase secrets set`                 | Only needed if Expo push security is enabled                                                                       |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected into Edge Functions by the platform — do not set them as secrets.

`.env.example` and `mobile/.env.example` list the same names.

## 2. Database

```bash
supabase link --project-ref <ref>
supabase db push          # applies migrations in supabase/migrations/
supabase gen types typescript --project-id <ref> > src/types/database.ts
```

**Preflight before the first push to a hosted project with legacy data:** the
mobile-first schema enforces one household per user. Resolve any duplicates
first, or the migration will fail:

```sql
select user_id, count(*)
from public.household_members
group by user_id
having count(*) > 1;
```

## 3. Authentication

Production is **Google and Apple only**; email/password exists solely for the
seeded local/test accounts.

1. Supabase dashboard → Authentication → Providers → enable Google and Apple
   with the client id/secret from each provider console.
2. Authentication → URL Configuration:
   - Site URL: the Vercel production URL.
   - Redirect URLs: `https://<production-host>/auth/callback`, every preview
     host you sign in from, and `householdhub://auth/callback` for native.
3. Authentication → Sign In / Up → **disable signups**. This app is
   invite-only; accounts arrive through the seed script or a household invite.
   (The local `supabase/config.toml` deliberately keeps `enable_signup = true`
   — see the comment there.)
4. Provider consoles: add the same redirect URLs. Apple additionally needs the
   Services ID, key, and team id used to mint the client secret.

## 4. Edge Functions

```bash
supabase functions deploy household-admin
supabase functions deploy calendar-reminder-scheduler
supabase functions deploy push-dispatch
supabase functions deploy recurring-transfer-executor
supabase functions deploy notification-cleanup

# Only if Expo push security is enabled for the project:
supabase secrets set EXPO_ACCESS_TOKEN=<token>
```

`verify_jwt` is on for all five (`supabase/config.toml`). `household-admin` is
called by signed-in clients; the other four additionally require the
service-role key **inside** the function, so a leaked anon key cannot run them.

Run the unit tests with `npm run test:functions` (Deno).

### Schedules

Set these in the Supabase dashboard (Integrations → Cron), or with `pg_cron` +
`pg_net`. Each POSTs to the function with the service-role key as a bearer
token.

| Function                      | Cadence           | Why                                                                                   |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `calendar-reminder-scheduler` | every 5 minutes   | Reminder resolution; a reminder more than 60 minutes late is dropped rather than sent |
| `push-dispatch`               | every 1–5 minutes | Delivery latency for inbox notifications                                              |
| `recurring-transfer-executor` | hourly            | Occurrences fire at a wall-clock time in the schedule's timezone                      |
| `notification-cleanup`        | daily             | 90-day read-notification retention                                                    |

All four are idempotent: reminder dispatches are unique per
(event, preset, occurrence), push deliveries per (notification, device), and
transfer occurrences per (schedule, date). Re-running or overlapping runs
cannot double-send or double-move money.

## 5. Web (Vercel)

Unchanged from `DEPLOYMENT.md`: framework preset Vite, build `npm run build`,
output `dist`. `vercel.json` provides the SPA rewrite plus cache headers —
hashed files under `/assets` are immutable for a year, while `index.html`,
`sw.js`, and the web manifest must revalidate so a deploy is picked up.

## 6. Native (Expo / EAS)

`mobile/app.json` carries the release identity:

- scheme `householdhub` (OAuth callback `householdhub://auth/callback`)
- bundle id / package `com.conlegs.householdhub`
- portrait-only, phones only (`supportsTablet: false`)
- `POST_NOTIFICATIONS` for Android 13+

`mobile/eas.json` defines `development` (development client, internal
distribution), `preview`, and `production` profiles.

```bash
cd mobile
eas login
eas build:configure          # writes the EAS project id into app.json
eas build --profile development --platform ios
eas build --profile development --platform android
```

Development builds — not Expo Go — are required for notifications and native
modules. `expo-notifications` and its config plugin are installed in Task 7;
until then `app.json` declares identity and permissions only.

## 7. Seeding

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/seed-household.ts --name "Household" \
    --member "a@example.com:password:Name A" \
    --member "b@example.com:password:Name B"
```

Only the auth users are created with the service-role key; the household is
provisioned through the real path (`onboard_household`, then an invite the
second member redeems), so seeded rows match what the app produces. Re-running
is safe.

## 8. Not covered here

The production data reset is Task 9 and requires a separate release-time
approval. Nothing in this document deletes application data.
