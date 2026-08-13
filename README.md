# Household Hub

Household Hub includes a Vite web application and an Expo mobile application
that share domain and application packages.

## Repository layout

| Path        | Purpose                                                      |
| ----------- | ------------------------------------------------------------ |
| `src/`      | React web application                                        |
| `mobile/`   | Expo mobile application                                      |
| `packages/` | Shared domain and application packages                       |
| `supabase/` | Local Supabase configuration, migrations, and Edge Functions |
| `scripts/`  | Local setup utilities                                        |

## Prerequisites

- Node.js 20.19 or newer
- npm
- Docker Desktop
- Deno for Edge Function tests
- Xcode for iOS development
- Android Studio and an Android emulator for Android development

Run all shared and web commands from the repository root.

## Shared local setup

### 1. Install dependencies

```bash
npm install
```

The root install includes the `mobile` workspace.

### 2. Start Supabase

```bash
npx supabase start
npx supabase status
```

The status output contains the local anon key and service-role key. Keep the
service-role key out of committed files.

### 3. Configure the web application

```bash
cp .env.example .env.local
```

Set the following values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:55321
VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-status>
VITE_ENABLE_TEST_AUTH=true
```

### 4. Configure the mobile application

```bash
cp mobile/.env.example mobile/.env.local
```

For the iOS Simulator, set:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-status>
EXPO_PUBLIC_ENABLE_TEST_AUTH=true
```

For an Android emulator, use
`EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:55321` so the emulator can reach the
Mac host. A physical device needs the Mac's reachable LAN address instead of
`127.0.0.1`.

Only public, anon-scoped values belong in `EXPO_PUBLIC_*` variables.

### 5. Seed the test household

Replace the key placeholders with values from `npx supabase status`:

```bash
SUPABASE_URL=http://127.0.0.1:55321 \
SUPABASE_ANON_KEY=<anon-key> \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npx tsx scripts/seed-household.ts \
  --name "🐰 & 🐧 Test" \
  --member "yongju@test.local:household123:Yongju" \
  --member "claire@test.local:household123:Claire"
```

The seed command creates the two accounts and their household. Re-running it
preserves existing feature data and refreshes the test passwords.

## Run the web application

From the repository root:

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) and use a test account
below.

## Run the mobile application

Mobile uses an Expo development build because Expo Go does not support all
required native modules and notification behavior.

From `mobile/`, build and launch the required platform:

```bash
cd mobile
npm run ios
```

or:

```bash
cd mobile
npm run android
```

After the development client is installed, start Metro for later sessions with:

```bash
cd mobile
npm start
```

## Test credentials

These credentials are for the seeded local Supabase stack:

| Name   | Email               | Password       | Role   |
| ------ | ------------------- | -------------- | ------ |
| Yongju | `yongju@test.local` | `household123` | Owner  |
| Claire | `claire@test.local` | `household123` | Member |

Password sign-in appears only when the web and mobile test-auth variables are
set to `true`.

## Verification commands

Run web and shared checks from the repository root:

```bash
npm test -- --run
npm run lint
npm run build
npm run test:functions
```

Run mobile checks from `mobile/`:

```bash
npm test -- --runInBand
npm run typecheck
```

## Stop local services

From the repository root:

```bash
npx supabase stop
```
