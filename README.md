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

The status output contains a local **Publishable** key and **Secret** key.
Publishable replaces the legacy anon key; Secret replaces the legacy
service-role key. Keep the Secret key out of committed files.

### 3. Configure the web application

```bash
cp .env.example .env.local
```

Set the following values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:55321
VITE_SUPABASE_ANON_KEY=<publishable-key-from-supabase-status>
VITE_ENABLE_TEST_AUTH=true
```

### 4. Configure the mobile application

```bash
cp mobile/.env.example mobile/.env.local
```

For the iOS Simulator, set:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable-key-from-supabase-status>
EXPO_PUBLIC_ENABLE_TEST_AUTH=true
```

For an Android emulator, use
`EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:55321` so the emulator can reach the
Mac host. A physical device needs the Mac's reachable LAN address instead of
`127.0.0.1`.

Only public, anon-scoped values belong in `EXPO_PUBLIC_*` variables.

### 5. Seed the test household

Replace the key placeholders with the **Publishable** and **Secret** values
from your local `npx supabase status` output. Do not use JWT examples copied
from Supabase documentation:

```bash
SUPABASE_URL=http://127.0.0.1:55321 \
SUPABASE_ANON_KEY=<publishable-key> \
SUPABASE_SERVICE_ROLE_KEY=<secret-key> \
npx tsx scripts/seed-household.ts \
  --name "🐰 & 🐧 Test" \
  --member "yongju@test.local:household123:Yongju" \
  --member "claire@test.local:household123:Claire"
```

The seed command creates the two accounts and their household. Re-running it
preserves existing feature data and refreshes the test passwords.

### Native Node module troubleshooting

If `npx tsx` reports that `@esbuild/darwin-x64` is installed but your
platform needs `@esbuild/darwin-arm64`, Node and the dependencies were
installed under different macOS architectures. Confirm the current runtime:

```bash
node -p "process.arch"
```

On Apple Silicon, reinstall dependencies from an arm64 Node shell:

```bash
rm -rf node_modules
npm install
```

Then rerun the seed command. Do not mix Rosetta/x64 Node with arm64 Node in the
same checkout.

## Run the web application

From the repository root:

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) and use a test account
below.

## Run the mobile application

The mobile app has two parts:

- The **development build** is the native iOS or Android app installed on your
  simulator/device. It contains native modules such as notifications,
  SQLite, and SecureStore.
- **Metro** is the JavaScript development server. It bundles the TypeScript and
  React Native code and sends it to the installed development build. Metro is
  what makes fast refresh work when you edit a screen.

Expo Go is not used for this project because it does not include every native
module and notification behavior required by Household Hub.

### One-time setup

Complete the [shared local setup](#shared-local-setup) first, including:

1. `npm install` from the repository root.
2. `npx supabase start` from the repository root.
3. `mobile/.env.local` with the local Supabase URL, Publishable key, and
   `EXPO_PUBLIC_ENABLE_TEST_AUTH=true`.

Choose one platform below. You only need to complete the setup for the
platform you intend to use.

### iOS Simulator

Install Xcode from the App Store and open it once so its components and license
are initialized. Then start the Simulator, or let Expo open it for you:

```bash
open -a Simulator
```

From the repository root, run the first native build:

```bash
cd mobile
npm run ios
```

This command runs `expo run:ios`. On the first run it compiles the native iOS
project, installs the Household Hub development build in the Simulator, and
starts the JavaScript bundler. The first build can take several minutes. If
the build succeeds but the app cannot connect to `127.0.0.1:8081`, stop that
bundler and follow the LAN-mode steps below.

When the app opens, tap the local test sign-in option and use one of the test
accounts below. Keep the terminal running while you develop.

### Android emulator

Install Android Studio, create an emulator in **Device Manager**, and start it
before launching the app. Confirm that the emulator is visible to the Android
toolchain:

```bash
adb devices
```

From the repository root, run the first native build:

```bash
cd mobile
npm run android
```

This command runs `expo run:android`. It compiles the native Android project,
installs the Household Hub development build in the running emulator, and
starts the JavaScript bundler. The mobile environment uses
`http://10.0.2.2:55321` for the Supabase URL because `10.0.2.2` maps from the
Android emulator back to your Mac.

### Later sessions

After the development build has been installed, do not run the native build
command every time. Start Metro in LAN mode from the repository root. LAN mode
lets the iOS Simulator connect to Metro through the Mac's network address:

```bash
cd mobile
npx expo start --dev-client --lan
```

Then open the already-installed **Household Hub** development build in the
Simulator or emulator. Press `i` in the Metro terminal if Expo does not open
the Simulator automatically. Leave Metro running; its terminal shows bundle
errors and reload messages.

Do not use `npx expo start --dev-client --localhost` for this setup: the
development build may receive `127.0.0.1:8081` but fail to connect to it. If
the app is already showing “Searching for development servers,” close it,
restart Metro with LAN mode, and reopen the app.

Your normal daily workflow is:

1. Start local Supabase in one terminal: `npx supabase start`.
2. Start Metro in another terminal: `cd mobile && npx expo start --dev-client --lan`.
3. Open the installed Household Hub development build.
4. Edit files; Metro applies JavaScript changes with fast refresh.
5. Stop Metro with `Ctrl+C` when finished.

Run `npm run ios` or `npm run android` again when you change native
dependencies, permissions, the Expo config, or native code. Ordinary screen and
styling changes only require Metro to be restarted if it is not already running.

### Physical device notes

For a physical iPhone or Android device, the device and Mac must be on the same
network. Replace `127.0.0.1` in `mobile/.env.local` with the Mac's LAN IP
address, then rebuild or restart the development client so the new value is
embedded in the app.

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
