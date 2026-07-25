# Persistent Local Demo Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zero-login `npm run demo` workflow that opens the web app as a real, seeded local Supabase household and preserves every manual edit until an explicit demo reset.

**Architecture:** A pure demo-mode resolver guards the browser auth bootstrap with development, explicit-flag, loopback-URL, and complete-credential checks. Node-side demo tooling provisions two local auth users through the existing onboarding/invite path, applies deterministic sample commands through `apply_household_operation`, and starts Vite in `demo` mode. Deterministic operation IDs make repeated seeding return `duplicate`, so later runs never overwrite manual edits.

**Tech Stack:** Vite 8, React 19, TypeScript 6, Supabase Auth/Postgres/RPC, Vitest 4, Node `child_process`, Node `readline/promises`, existing `@household-hub/domain` operation contracts.

## Global Constraints

- Production authentication remains Google and Apple OAuth only.
- Demo mode is web-development-only and must never work in a production build, preview build, or against a non-loopback Supabase URL.
- Remove `VITE_DISABLE_AUTH`; the rebuilt shell must never run without a real Supabase session.
- `npm run demo` must require no manual login and must preserve manually entered data across runs.
- Seed through real onboarding, invites, and `apply_household_operation`; do not insert directly into mutable household tables.
- Demo seed commands use deterministic UUIDs and operation IDs; repeated seed runs accept only `applied` or `duplicate`.
- Demo credentials live only in ignored `.env.demo.local`; no password or service-role key is committed or printed.
- `npm run demo:reset` is the only destructive demo command and must require typed confirmation before deleting only the named local demo household and users.
- Preserve all existing unrelated untracked files.
- Run Node commands with `PATH="/opt/homebrew/bin:$PATH"` in this worktree.
- Stop after each task, provide the user a detailed report, and wait for approval before starting the next task.

---

## File Structure

### Browser runtime

- Create `src/lib/demoMode.ts`: pure environment validation and demo account configuration.
- Modify `src/hooks/useAuth.ts`: expose demo status and role switching through the auth context.
- Modify `src/components/auth/AuthProvider.tsx`: reuse a session, auto-sign in once when needed, report failure, and switch demo identities safely.
- Modify `src/components/auth/RequireAuth.tsx`: remove the sessionless bypass and retain the ordinary protected-route gate.
- Modify `src/routes/LoginPage.tsx`: show a demo bootstrap recovery message when automatic sign-in fails.
- Create `src/features/settings/DemoAccountSwitcher.tsx`: development-only owner/partner switcher.
- Modify `src/features/settings/SettingsScreen.tsx`: mount the switcher in Settings only while demo mode is active.

### Node-side demo tooling

- Modify `scripts/seed-household.ts`: export reusable household provisioning while preserving its CLI.
- Create `scripts/demo/accounts.ts`: read or create ignored demo credentials.
- Create `scripts/demo/localSupabase.ts`: parse and validate `supabase status -o env`.
- Create `scripts/demo/sampleData.ts`: deterministic entity IDs and operation command definitions.
- Create `scripts/demo/seedDemo.ts`: provision accounts/household and apply missing demo commands.
- Create `scripts/demo/runDemo.ts`: check prerequisites, seed, and start Vite.
- Create `scripts/demo/resetDemo.ts`: confirm, delete the exact demo household/users, and reseed.
- Create `scripts/demo/verifyDemo.ts`: authenticate as both members and verify RLS-visible sample counts.
- Create `scripts/demo/buildSafety.ts`: reject demo credentials/flags during Vite production builds.

### Tests and configuration

- Create `src/test/demoMode.test.ts`.
- Modify `src/test/AuthProvider.test.tsx`.
- Modify `src/test/RequireAuth.test.tsx`.
- Modify `src/test/mocks/supabase.ts`.
- Create `src/test/DemoAccountSwitcher.test.tsx`.
- Create `scripts/demo/accounts.test.ts`.
- Create `scripts/demo/localSupabase.test.ts`.
- Create `scripts/demo/sampleData.test.ts`.
- Create `scripts/demo/seedDemo.test.ts`.
- Create `scripts/demo/resetDemo.test.ts`.
- Create `scripts/demo/buildSafety.test.ts`.
- Modify `package.json`, `.env.example`, `vite.config.ts`, `progress.md`, and `docs/superpowers/progress-detail.md`.

---

### Task 1: Guarded browser demo authentication

**Files:**
- Create: `src/lib/demoMode.ts`
- Modify: `src/hooks/useAuth.ts`
- Modify: `src/components/auth/AuthProvider.tsx`
- Modify: `src/components/auth/RequireAuth.tsx`
- Modify: `src/routes/LoginPage.tsx`
- Modify: `src/test/mocks/supabase.ts`
- Create: `src/test/demoMode.test.ts`
- Modify: `src/test/AuthProvider.test.tsx`
- Modify: `src/test/RequireAuth.test.tsx`

**Interfaces:**
- Produces:

```ts
export type DemoRole = 'owner' | 'partner'

export interface DemoAccount {
  email: string
  password: string
}

export interface DemoModeConfig {
  enabled: boolean
  accounts: Record<DemoRole, DemoAccount> | null
  configurationError: string | null
}

export interface DemoModeEnvironment {
  isDev: boolean
  isProd: boolean
  autoLogin: string | undefined
  supabaseUrl: string | undefined
  ownerEmail: string | undefined
  ownerPassword: string | undefined
  partnerEmail: string | undefined
  partnerPassword: string | undefined
}

export function resolveDemoModeConfig(
  environment: DemoModeEnvironment,
): DemoModeConfig

export interface DemoAuthState {
  enabled: boolean
  activeRole: DemoRole | null
  error: string | null
  switchRole(role: DemoRole): Promise<{ error: string | null }>
}
```

- Modifies `AuthContextValue` to add `demo: DemoAuthState`.
- Consumes the existing `supabase.auth.getSession`, `signInWithPassword`, `onAuthStateChange`, and React Query cache.

- [ ] **Step 1: Write resolver tests that define the security boundary**

Create `src/test/demoMode.test.ts` with table-driven cases:

```ts
import { describe, expect, it } from 'vitest'
import { resolveDemoModeConfig } from '@/lib/demoMode'

const complete = {
  isDev: true,
  isProd: false,
  autoLogin: 'true',
  supabaseUrl: 'http://127.0.0.1:55321',
  ownerEmail: 'demo-owner@householdhub.local',
  ownerPassword: 'owner-secret',
  partnerEmail: 'demo-partner@householdhub.local',
  partnerPassword: 'partner-secret',
}

describe('resolveDemoModeConfig', () => {
  it('enables complete demo credentials against local Supabase', () => {
    expect(resolveDemoModeConfig(complete)).toMatchObject({
      enabled: true,
      configurationError: null,
    })
  })

  it.each([
    [{ ...complete, isDev: false, isProd: true }, 'production'],
    [{ ...complete, supabaseUrl: 'https://project.supabase.co' }, 'loopback'],
    [{ ...complete, ownerPassword: undefined }, 'credentials'],
  ])('rejects unsafe or incomplete configuration', (input, message) => {
    const result = resolveDemoModeConfig(input)
    expect(result.enabled).toBe(false)
    expect(result.configurationError).toContain(message)
  })
})
```

- [ ] **Step 2: Run the resolver tests and verify they fail**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run src/test/demoMode.test.ts
```

Expected: FAIL because `src/lib/demoMode.ts` does not exist.

- [ ] **Step 3: Implement the pure demo-mode resolver**

Create `src/lib/demoMode.ts`. Parse the URL with `new URL`, accept only hostnames `localhost`, `127.0.0.1`, and `::1`, and return a disabled configuration unless every guard passes. Export:

```ts
export const demoModeConfig = resolveDemoModeConfig({
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  autoLogin: import.meta.env.VITE_AUTO_LOGIN_DEMO,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  ownerEmail: import.meta.env.VITE_DEMO_OWNER_EMAIL,
  ownerPassword: import.meta.env.VITE_DEMO_OWNER_PASSWORD,
  partnerEmail: import.meta.env.VITE_DEMO_PARTNER_EMAIL,
  partnerPassword: import.meta.env.VITE_DEMO_PARTNER_PASSWORD,
})
```

When `autoLogin !== 'true'`, return `{ enabled: false, accounts: null, configurationError: null }`. When the flag is true but a guard fails, return a specific recovery error rather than silently enabling demo mode.

- [ ] **Step 4: Write failing AuthProvider tests for reuse, automatic sign-in, and failure**

Extend `src/test/mocks/supabase.ts` so `mockSignInWithPassword` is available to `AuthProvider.test.tsx`. In `src/test/AuthProvider.test.tsx`, mock `@/lib/demoMode` with a complete enabled configuration and add:

```ts
function renderAuthHook() {
  const queryClient = new QueryClient()
  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    )
  }
  return renderHook(() => useAuth(), { wrapper })
}

it('reuses an existing session without automatic sign-in', async () => {
  mockGetSession.mockResolvedValue({ data: { session: fakeSession } })
  const { result } = renderAuthHook()
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(mockSignInWithPassword).not.toHaveBeenCalled()
})

it('automatically signs in the owner when no session exists', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } })
  mockSignInWithPassword.mockResolvedValue({
    data: { session: fakeSession, user: fakeSession.user },
    error: null,
  })
  const { result } = renderAuthHook()
  await waitFor(() => expect(result.current.session).toBe(fakeSession))
  expect(mockSignInWithPassword).toHaveBeenCalledWith({
    email: 'demo-owner@householdhub.local',
    password: 'owner-secret',
  })
})

it('finishes loading with a recovery error when automatic sign-in fails', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } })
  mockSignInWithPassword.mockResolvedValue({
    data: { session: null, user: null },
    error: { message: 'Invalid login credentials' },
  })
  const { result } = renderAuthHook()
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.demo.error).toContain('demo')
})
```

Keep the existing cache-clear test. Add a disabled demo object to each
`AuthContextValue` literal in `RequireAuth.test.tsx`.

- [ ] **Step 5: Run the AuthProvider tests and verify they fail**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run src/test/AuthProvider.test.tsx src/test/RequireAuth.test.tsx
```

Expected: FAIL because the provider does not expose demo state or auto-sign in.

- [ ] **Step 6: Implement automatic sign-in and remove the sessionless bypass**

In `AuthProvider.tsx`:

1. Call `getSession`.
2. If a valid session exists, use it immediately.
3. If no session exists and demo mode is enabled, call `signInWithPassword` with the owner credentials and set the returned session.
4. If sign-in fails, keep `session = null`, set `demo.error`, and finish loading.
5. In `onAuthStateChange`, clear React Query whenever the previous and next user IDs differ, including direct owner/partner switching.
6. Implement `switchRole(role)` by calling `signInWithPassword` for the selected demo account without signing out first; update the session only on success so a failed switch leaves the current session intact.

In `RequireAuth.tsx`, delete `AUTH_DISABLED` and the early return. The only successful protected-route condition remains `session !== null`.

In `LoginPage.tsx`, read `demo.error` and render:

```tsx
{demo.error && (
  <p role="alert" className="mb-4 text-sm text-[var(--hh-danger)]">
    Demo sign-in failed. Run npm run demo:seed, then reload. {demo.error}
  </p>
)}
```

- [ ] **Step 7: Run focused authentication tests**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run \
  src/test/demoMode.test.ts \
  src/test/AuthProvider.test.tsx \
  src/test/RequireAuth.test.tsx \
  src/test/LoginForm.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run affected lint and typecheck**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx eslint \
  src/lib/demoMode.ts \
  src/hooks/useAuth.ts \
  src/components/auth/AuthProvider.tsx \
  src/components/auth/RequireAuth.tsx \
  src/routes/LoginPage.tsx \
  src/test/demoMode.test.ts \
  src/test/AuthProvider.test.tsx \
  src/test/RequireAuth.test.tsx
PATH="/opt/homebrew/bin:$PATH" npx tsc -b --pretty false
```

Expected: both commands exit 0.

- [ ] **Step 9: Commit and stop for the Task 1 report**

```bash
git add src/lib/demoMode.ts src/hooks/useAuth.ts \
  src/components/auth/AuthProvider.tsx src/components/auth/RequireAuth.tsx \
  src/routes/LoginPage.tsx src/test/mocks/supabase.ts \
  src/test/demoMode.test.ts src/test/AuthProvider.test.tsx \
  src/test/RequireAuth.test.tsx
git commit -m "feat: add guarded local demo authentication"
```

Report the exact tests, security guards, and changed auth flow. Wait for the user's approval before Task 2.

---

### Task 2: Idempotent household and sample-data provisioning

**Files:**
- Modify: `scripts/seed-household.ts`
- Create: `scripts/demo/sampleData.ts`
- Create: `scripts/demo/seedDemo.ts`
- Create: `scripts/demo/sampleData.test.ts`
- Create: `scripts/demo/seedDemo.test.ts`

**Interfaces:**
- Produces:

```ts
export interface HouseholdMemberSeed {
  email: string
  password: string
  displayName: string
}

export interface ProvisionHouseholdOptions {
  url: string
  anonKey: string
  serviceRoleKey: string
  householdName: string
  owner: HouseholdMemberSeed
  partner: HouseholdMemberSeed
  synchronizeExistingPasswords?: boolean
}

export interface ProvisionedHousehold {
  householdId: string
  ownerUserId: string
  partnerUserId: string
  ownerClient: SupabaseClient
  partnerClient: SupabaseClient
}

export async function provisionHousehold(
  options: ProvisionHouseholdOptions,
): Promise<ProvisionedHousehold>

export interface DemoSeedContext {
  householdId: string
  ownerUserId: string
  partnerUserId: string
}

export function buildDemoCommands(
  context: DemoSeedContext,
): OperationCommand[]

export type DemoSeedOptions = ProvisionHouseholdOptions

export interface DemoSeedResult {
  applied: number
  duplicate: number
  householdId: string
  ownerUserId: string
  partnerUserId: string
}

export async function seedDemo(
  options: DemoSeedOptions,
): Promise<DemoSeedResult>
```

- Consumes `OperationCommand` and `isOperationResult` from `@household-hub/domain`.
- Calls `ownerClient.rpc('apply_household_operation', { command })` sequentially.

- [ ] **Step 1: Refactor household provisioning behind an exported function**

Write tests around argument parsing only if parsing behavior changes. Move the existing create/reuse/onboard/invite flow into `provisionHousehold(options)`. When `synchronizeExistingPasswords` is true and a dedicated demo user already exists, call:

```ts
await admin.auth.admin.updateUserById(userId, {
  password: member.password,
  email_confirm: true,
})
```

After onboarding or reuse, query the owner's membership for `household_id` and return the two authenticated clients plus IDs. Preserve the current command-line entry point with:

```ts
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
}
```

- [ ] **Step 2: Write failing deterministic sample-command tests**

Create `scripts/demo/sampleData.test.ts` with Node environment:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isOperationCommand } from '@household-hub/domain'
import { buildDemoCommands } from './sampleData'

const context = {
  householdId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ownerUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  partnerUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
}

describe('buildDemoCommands', () => {
  it('builds valid, unique, dependency-ordered commands', () => {
    const commands = buildDemoCommands(context)
    expect(commands.every(isOperationCommand)).toBe(true)
    expect(new Set(commands.map((command) => command.operationId)).size)
      .toBe(commands.length)
    expect(commands.findIndex((command) => command.type === 'ledger.asset.upsert'))
      .toBeLessThan(commands.findIndex((command) => command.type === 'ledger.transaction.upsert'))
  })

  it('is deterministic across runs', () => {
    expect(buildDemoCommands(context)).toEqual(buildDemoCommands(context))
  })
})
```

- [ ] **Step 3: Run the sample-command tests and verify they fail**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run scripts/demo/sampleData.test.ts
```

Expected: FAIL because `sampleData.ts` does not exist.

- [ ] **Step 4: Implement the deterministic sample data**

Create `scripts/demo/sampleData.ts` with one fixed demo device UUID, monotonic `localSequence`, fixed `enqueuedAt` instants, and distinct UUIDs for every operation and entity.

The command list must include, in dependency order:

| Feature | Required sample records |
| --- | --- |
| Calendar | Shared all-day “Grocery run” on 2026-07-26; owner timed “Payday review”; partner timed “Dentist”; one event with `10m`; one weekly recurring event. |
| Groceries | “Save-on-food” and “Costco”; Eggs, checked Milk, Sourdough bread; Eggs updated from CA$4.99 to CA$3.98 using a second operation with `baseRevision: 1` so price history has two immutable rows. |
| Assets | CAD Chequing, CAD Credit Card, CAD Savings, GBP Cash; balances large enough for all seeded spending; one CAD transfer and one monthly CAD schedule. |
| Ledger | 2026 Statement; Salary and Bonus income categories; Groceries, Dining out, Utilities spending categories; limits from January through December; July income and spending transactions that produce visible monthly and category summaries. |
| Notes | “Before we leave” with a task list; “Household ideas” with Heading 1, bullet list, and numbered list. |
| Trips | “2027 London” in `Europe/London` with GBP and “2025 Tokyo” in `Asia/Tokyo` with JPY; one CAD London expense on the CAD Credit Card and one GBP London expense on GBP Cash. |

Map client reminder `at-time` to the RPC payload value `at_time`; do not send `none` because an empty reminder array represents no reminders.

Use the restricted note structure exactly:

```ts
{
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Before we leave' }],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Passports' }],
            },
          ],
        },
      ],
    },
  ],
}
```

For an entity update such as the second Eggs price, use a unique operation ID, the same entity ID, and the expected previous revision. All first creates use `baseRevision: null`.

- [ ] **Step 5: Implement sequential demo seeding**

Create `scripts/demo/seedDemo.ts`. It must:

1. Call `provisionHousehold` with `synchronizeExistingPasswords: true`.
2. Build commands from returned household/member IDs.
3. Call `apply_household_operation` one command at a time.
4. Validate every response with `isOperationResult`.
5. Accept only `applied` and `duplicate`.
6. Throw an error naming the operation type, entity ID, status, and reason on `conflict` or `rejected`.
7. Return counts `{ applied, duplicate, householdId, ownerUserId, partnerUserId }`.

Core loop:

```ts
for (const command of buildDemoCommands(context)) {
  const { data, error } = await ownerClient.rpc('apply_household_operation', {
    command,
  })
  if (error) throw new Error(`${command.type}: ${error.message}`)
  if (!isOperationResult(data)) {
    throw new Error(`${command.type}: invalid operation result`)
  }
  if (data.status !== 'applied' && data.status !== 'duplicate') {
    throw new Error(`${command.type} ${command.entityId}: ${data.status}`)
  }
}
```

- [ ] **Step 6: Write seed-executor tests for duplicate-safe behavior**

Create `scripts/demo/seedDemo.test.ts`. Mock `provisionHousehold` and the
owner's RPC. Assert:

- one sequential RPC call per command;
- a mixture of `applied` and `duplicate` succeeds;
- the first `conflict` or `rejected` stops seeding and reports the entity;
- no direct `.from(...).insert(...)` call exists in demo seeding.

- [ ] **Step 7: Run focused provisioning tests and static checks**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run \
  scripts/demo/sampleData.test.ts \
  scripts/demo/seedDemo.test.ts
PATH="/opt/homebrew/bin:$PATH" npx eslint \
  scripts/seed-household.ts scripts/demo/sampleData.ts scripts/demo/seedDemo.ts \
  scripts/demo/sampleData.test.ts scripts/demo/seedDemo.test.ts
PATH="/opt/homebrew/bin:$PATH" npx tsc -b --pretty false
```

Expected: all exit 0.

- [ ] **Step 8: Commit and stop for the Task 2 report**

```bash
git add scripts/seed-household.ts scripts/demo/sampleData.ts \
  scripts/demo/seedDemo.ts scripts/demo/sampleData.test.ts \
  scripts/demo/seedDemo.test.ts
git commit -m "feat: seed persistent local demo household"
```

Report the exact seeded entities, idempotency mechanism, and RPC-only data path. Wait for approval before Task 3.

---

### Task 3: Demo runner, credentials, reset, and build safeguards

**Files:**
- Create: `scripts/demo/accounts.ts`
- Create: `scripts/demo/localSupabase.ts`
- Create: `scripts/demo/runDemo.ts`
- Create: `scripts/demo/resetDemo.ts`
- Create: `scripts/demo/verifyDemo.ts`
- Create: `scripts/demo/buildSafety.ts`
- Create: `scripts/demo/accounts.test.ts`
- Create: `scripts/demo/localSupabase.test.ts`
- Create: `scripts/demo/resetDemo.test.ts`
- Create: `scripts/demo/buildSafety.test.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces:

```ts
export interface DemoAccounts {
  householdName: '🐰 & 🐧 Demo'
  owner: HouseholdMemberSeed
  partner: HouseholdMemberSeed
}

export async function ensureDemoAccounts(
  filePath?: string,
): Promise<DemoAccounts>

export interface LocalSupabaseEnvironment {
  url: string
  anonKey: string
  serviceRoleKey: string
}

export function parseSupabaseStatus(output: string): LocalSupabaseEnvironment
export async function readLocalSupabaseEnvironment(): Promise<LocalSupabaseEnvironment>
export function assertDemoBuildSafe(
  command: string,
  environment: Record<string, string>,
): void
```

- Consumes `seedDemo` from Task 2.
- Creates ignored `.env.demo.local` with file mode `0o600`.

- [ ] **Step 1: Write failing tests for local status parsing and credential persistence**

`scripts/demo/localSupabase.test.ts` must parse the exact CLI names:

```text
API_URL="http://127.0.0.1:55321"
ANON_KEY="anon-value"
SERVICE_ROLE_KEY="service-value"
```

It must reject missing keys and any non-loopback API URL.

`scripts/demo/accounts.test.ts` must use a temporary directory and assert:

- first call creates owner/partner credentials;
- second call returns byte-for-byte equivalent accounts;
- file mode masks group/other permissions;
- passwords are never written to stdout by the helper.

- [ ] **Step 2: Run the tooling tests and verify they fail**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run \
  scripts/demo/localSupabase.test.ts \
  scripts/demo/accounts.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement ignored credential generation**

Create `.env.demo.local` through `ensureDemoAccounts` only when absent. Use fixed local-only emails and random passwords:

```ts
const ownerEmail = 'demo-owner@householdhub.local'
const partnerEmail = 'demo-partner@householdhub.local'
const password = () => randomBytes(24).toString('base64url')
```

Write only these browser-safe local variables:

```text
VITE_AUTO_LOGIN_DEMO=true
VITE_DEMO_OWNER_EMAIL=demo-owner@householdhub.local
VITE_DEMO_OWNER_PASSWORD=<generated>
VITE_DEMO_PARTNER_EMAIL=demo-partner@householdhub.local
VITE_DEMO_PARTNER_PASSWORD=<generated>
```

Use `writeFile(filePath, content, { mode: 0o600, flag: 'wx' })`. Parse the existing file without logging values. Because `.gitignore` already ignores `*.local`, do not add an exception.

- [ ] **Step 4: Implement local Supabase detection**

Run `supabase status -o env` with `execFile`. Parse `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY`. On failure, throw:

```text
Local Supabase is not running. Start it with: supabase start
```

Reject any API URL whose hostname is not `localhost`, `127.0.0.1`, or `::1`.

- [ ] **Step 5: Write failing build-safety tests**

Create `scripts/demo/buildSafety.test.ts`:

```ts
it('rejects demo flags and credentials during a production build', () => {
  expect(() =>
    assertDemoBuildSafe('build', {
      VITE_AUTO_LOGIN_DEMO: 'true',
      VITE_DEMO_OWNER_PASSWORD: 'secret',
    }),
  ).toThrow(/demo credentials/i)
})

it('allows the demo Vite development server', () => {
  expect(() =>
    assertDemoBuildSafe('serve', { VITE_AUTO_LOGIN_DEMO: 'true' }),
  ).not.toThrow()
})
```

- [ ] **Step 6: Implement the runner and production build guard**

`runDemo.ts` must:

1. read local Supabase status;
2. ensure `.env.demo.local`;
3. call `seedDemo`;
4. print only household name and applied/duplicate counts;
5. spawn the local Vite binary with `['--mode', 'demo', '--open']`, passing
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the validated local
   status plus the demo variables loaded from `.env.demo.local`;
6. forward `SIGINT` and `SIGTERM` and exit with the Vite process code.

Never pass `SERVICE_ROLE_KEY` or a `VITE_`-prefixed service-role equivalent to
the Vite child process.

Add to `package.json`:

```json
"demo": "tsx scripts/demo/runDemo.ts",
"demo:seed": "tsx scripts/demo/runDemo.ts --seed-only",
"demo:reset": "tsx scripts/demo/resetDemo.ts",
"demo:verify": "tsx scripts/demo/verifyDemo.ts"
```

Change `vite.config.ts` to `defineConfig(({ command, mode }) => { ... })`, call `loadEnv(mode, process.cwd(), '')`, and invoke `assertDemoBuildSafe(command, environment)` before returning the config.

Update `.env.example`: remove `VITE_DISABLE_AUTH`; document the five demo variable names with empty values and state that `npm run demo` generates them in ignored `.env.demo.local`.

- [ ] **Step 7: Implement exact-target reset with typed confirmation**

Factor reset decision logic so it is unit-testable:

```ts
export function resetConfirmed(input: string): boolean {
  return input === 'RESET DEMO'
}
```

`resetDemo.ts` must:

1. verify loopback Supabase;
2. load the two exact dedicated demo emails;
3. print that only `🐰 & 🐧 Demo` and those two local users are targeted;
4. require the operator to type `RESET DEMO`;
5. query the owner membership and household ID;
6. call `delete_household()` as the authenticated owner when it exists;
7. delete only the two exact auth users with `admin.deleteUser`;
8. call `seedDemo` to rebuild the household.

Abort without mutations for EOF, empty input, or any other phrase. Test confirmation rejection and exact email targeting with injected dependencies.

- [ ] **Step 8: Implement the verification command**

`verifyDemo.ts` signs in as owner and partner separately and asserts:

- both see the same household ID;
- exactly two active household members are visible;
- Calendar, grocery lists, Assets, Ledger years, Notes, Trips, and Trip expenses each have at least one row;
- owner and partner queries return matching household-scoped counts.

Print names and counts only; never print access tokens, passwords, anon keys, or service-role keys.

- [ ] **Step 9: Run tooling tests and configuration checks**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run \
  scripts/demo/accounts.test.ts \
  scripts/demo/localSupabase.test.ts \
  scripts/demo/resetDemo.test.ts \
  scripts/demo/buildSafety.test.ts
PATH="/opt/homebrew/bin:$PATH" npm run lint
PATH="/opt/homebrew/bin:$PATH" npx tsc -b --pretty false
```

Expected: all exit 0.

- [ ] **Step 10: Verify the production build rejects demo credentials**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" VITE_AUTO_LOGIN_DEMO=true \
  VITE_DEMO_OWNER_PASSWORD=must-not-build npm run build
```

Expected: non-zero exit with a message that demo credentials are forbidden in a production build.

Then run:

```bash
PATH="/opt/homebrew/bin:$PATH" npm run build
rg -n "demo-owner@householdhub.local|must-not-build" dist
```

Expected: build exits 0; `rg` exits 1 with no matches.

- [ ] **Step 11: Commit and stop for the Task 3 report**

```bash
git add package.json package-lock.json .env.example vite.config.ts \
  scripts/demo/accounts.ts scripts/demo/localSupabase.ts \
  scripts/demo/runDemo.ts scripts/demo/resetDemo.ts \
  scripts/demo/verifyDemo.ts scripts/demo/buildSafety.ts \
  scripts/demo/accounts.test.ts scripts/demo/localSupabase.test.ts \
  scripts/demo/resetDemo.test.ts scripts/demo/buildSafety.test.ts
git commit -m "feat: add persistent local demo commands"
```

Report command behavior, credential handling, reset scope, and production-build evidence. Wait for approval before Task 4.

---

### Task 4: Development-only account switching

**Files:**
- Create: `src/features/settings/DemoAccountSwitcher.tsx`
- Modify: `src/features/settings/SettingsScreen.tsx`
- Create: `src/test/DemoAccountSwitcher.test.tsx`
- Modify: `src/test/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes `useAuth().demo` from Task 1.
- Produces a Settings-only control with `Owner` and `Partner` options.

- [ ] **Step 1: Write failing switcher tests**

Create `src/test/DemoAccountSwitcher.test.tsx`:

```tsx
function authValue(demo: DemoAuthState): AuthContextValue {
  return {
    session: { user: { id: 'owner' } } as Session,
    user: { id: 'owner', email: 'demo-owner@householdhub.local' } as User,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    demo,
  }
}

it('shows the current demo role and switches to the partner', async () => {
  const switchRole = vi.fn().mockResolvedValue({ error: null })
  mockedUseAuth.mockReturnValue(authValue({
    enabled: true, activeRole: 'owner', error: null, switchRole,
  }))
  render(<DemoAccountSwitcher />)
  expect(screen.getByText('Local demo household')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Partner' }))
  expect(switchRole).toHaveBeenCalledWith('partner')
})

it('renders nothing outside demo mode', () => {
  mockedUseAuth.mockReturnValue(authValue({
    enabled: false, activeRole: null, error: null, switchRole: vi.fn(),
  }))
  const { container } = render(<DemoAccountSwitcher />)
  expect(container).toBeEmptyDOMElement()
})
```

Also test that a failed switch renders an alert and leaves the selected role unchanged.

- [ ] **Step 2: Run the switcher tests and verify they fail**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run src/test/DemoAccountSwitcher.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the Settings-only switcher**

Render a self-contained `<section>` titled `Developer` only when
`demo.enabled` is true, using the same card classes as the local `Section`
helper in `SettingsScreen.tsx`. The component shows:

- `Local demo household`;
- active identity label `Owner` or `Partner`;
- two compact buttons;
- disabled controls while switching;
- `role="alert"` on failure.

Do not place a badge in the header or main feature screens because it would invalidate visual-reference screenshots.

After a successful switch, invalidate/refetch household queries by relying on the AuthProvider's user-ID cache clear and the existing feature queries. Do not reload the page.

- [ ] **Step 4: Mount the switcher and update Settings tests**

Place `<DemoAccountSwitcher />` after Account and before Danger zone in `SettingsScreen.tsx`. Update every mocked `AuthContextValue` in the Settings tests with a disabled demo object.

- [ ] **Step 5: Run focused Settings and authentication tests**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run \
  src/test/DemoAccountSwitcher.test.tsx \
  src/test/SettingsScreen.test.tsx \
  src/test/AuthProvider.test.tsx
PATH="/opt/homebrew/bin:$PATH" npx eslint \
  src/features/settings/DemoAccountSwitcher.tsx \
  src/features/settings/SettingsScreen.tsx \
  src/test/DemoAccountSwitcher.test.tsx \
  src/test/SettingsScreen.test.tsx
```

Expected: all exit 0.

- [ ] **Step 6: Commit and stop for the Task 4 report**

```bash
git add src/features/settings/DemoAccountSwitcher.tsx \
  src/features/settings/SettingsScreen.tsx \
  src/test/DemoAccountSwitcher.test.tsx \
  src/test/SettingsScreen.test.tsx
git commit -m "feat: add local demo account switching"
```

Report the visible Settings behavior and cache/session safety. Wait for approval before Task 5.

---

### Task 5: Live local verification and continuation handoff

**Files:**
- Modify: `progress.md`
- Modify: `docs/superpowers/progress-detail.md`

**Interfaces:**
- Consumes all four prior tasks.
- Produces the verified pre-Task-7 resume point and exact local demo commands.

- [ ] **Step 1: Reset the disposable local database for a clean integration test**

Run only against the verified loopback project:

```bash
PATH="/opt/homebrew/bin:$PATH" supabase status
PATH="/opt/homebrew/bin:$PATH" supabase db reset --local
```

Expected: the URL is loopback and all migrations/tests complete. This intentionally clears only the disposable local Supabase data used for verification; it does not touch hosted Supabase.

- [ ] **Step 2: Seed and verify the demo household**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npm run demo:seed
PATH="/opt/homebrew/bin:$PATH" npm run demo:verify
PATH="/opt/homebrew/bin:$PATH" npm run demo:seed
```

Expected:

- first seed reports `applied > 0`;
- verification reports two members and non-zero feature counts;
- second seed reports every command as `duplicate`.

- [ ] **Step 3: Prove manual edits persist**

Start:

```bash
PATH="/opt/homebrew/bin:$PATH" npm run demo
```

In the browser:

1. confirm Calendar opens without a login page;
2. add a uniquely named grocery item `Persistence check`;
3. stop and restart `npm run demo`;
4. confirm the item still exists;
5. clear browser site data;
6. reload and confirm automatic sign-in restores the same household and item;
7. switch to Partner in Settings and confirm the same item is visible.

Do not run `demo:reset` during this persistence proof.

- [ ] **Step 4: Run the complete affected verification suite**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run
PATH="/opt/homebrew/bin:$PATH" npm run lint
PATH="/opt/homebrew/bin:$PATH" npx tsc -b --pretty false
PATH="/opt/homebrew/bin:$PATH" npm run build
PATH="/opt/homebrew/bin:$PATH" git diff --check
```

Expected:

- every Vitest file passes;
- ESLint and TypeScript exit 0;
- production build exits 0 without demo credentials;
- diff check is clean.

- [ ] **Step 5: Update the canonical handoff**

Update `progress.md` with:

- the four implementation commits;
- exact `npm run demo`, `demo:seed`, `demo:verify`, and `demo:reset` behavior;
- confirmation that `VITE_DISABLE_AUTH` is removed;
- persistent demo data and explicit reset semantics;
- current verification counts;
- web UI correction remains next;
- Task 7 remains the first Expo/mobile task and must not start yet.

Add the detailed test transcript and demo architecture to `docs/superpowers/progress-detail.md`.

- [ ] **Step 6: Commit the handoff and stop**

```bash
git add progress.md docs/superpowers/progress-detail.md
git commit -m "docs: record persistent demo mode completion"
```

Provide the user a thorough final demo-mode report with commands, verification evidence, remaining web UI gaps, and the explicit statement that Task 7 has not started.
