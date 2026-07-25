# Restore Local Test Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the normal authenticated local workflow and provision two persistent local test accounts without adding a separate demo mode.

**Architecture:** Protected routes always require a real Supabase session. Local development enables the existing email/password form and provisions a two-member household through the existing `seed-household.ts` onboarding and invite flow; manually entered data then persists in local Supabase.

**Tech Stack:** React 19, Vite 8, Vitest 4, Supabase Auth/Postgres, existing household seed script.

## Global Constraints

- Production authentication behavior is unchanged.
- Do not add automatic login, demo commands, account switching, sample-data generators, or reset tooling.
- Local test data persists until the developer explicitly resets local Supabase.
- Preserve unrelated untracked files.
- Remove the two obsolete persistent-demo documents.
- Stop after this single implementation task and provide a detailed report.

---

### Task 1: Restore login and provision the test household

**Files:**
- Create: `src/test/RequireAuthDevelopment.test.tsx`
- Modify: `src/components/auth/RequireAuth.tsx`
- Modify locally, untracked: `.env.local`
- Delete: `docs/superpowers/specs/2026-07-25-persistent-local-demo-mode-design.md`
- Delete: `docs/superpowers/plans/2026-07-25-persistent-local-demo-mode.md`
- Modify: `progress.md`

**Interfaces:**
- Protected routes continue to consume `useAuth(): AuthContextValue`.
- `RequireAuth` renders children only with a session, renders nothing while loading, and redirects unauthenticated users to `/login`.
- Existing `scripts/seed-household.ts` provisions the household through `onboard_household`, invitation creation, and invitation redemption.

- [ ] **Step 1: Add a failing development-mode regression test**

Create `src/test/RequireAuthDevelopment.test.tsx`. Stub the legacy environment flag before dynamically importing `RequireAuth`, mock `useAuth` with no session, and assert that the login route renders:

```tsx
it('still requires login when the legacy disable-auth flag is true', async () => {
  vi.stubEnv('MODE', 'development')
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DISABLE_AUTH', 'true')
  vi.resetModules()

  const { RequireAuth } = await import('@/components/auth/RequireAuth')

  render(
    <MemoryRouter initialEntries={['/calendar']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/calendar"
          element={
            <RequireAuth>
              <div>Calendar</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByText('Login Page')).toBeInTheDocument()
  expect(screen.queryByText('Calendar')).not.toBeInTheDocument()
})
```

The mocked `useAuth` value is:

```ts
{
  session: null,
  user: null,
  loading: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
}
```

- [ ] **Step 2: Run the regression test and verify RED**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run src/test/RequireAuthDevelopment.test.tsx
```

Expected: FAIL because the current development escape hatch renders `Calendar`.

- [ ] **Step 3: Remove the sessionless authentication bypass**

Delete `AUTH_DISABLED` and `if (AUTH_DISABLED) return <>{children}</>` from `src/components/auth/RequireAuth.tsx`. Retain:

```tsx
if (loading) return null
if (!session) return <Navigate to="/login" replace />
return <>{children}</>
```

- [ ] **Step 4: Run focused authentication tests and verify GREEN**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run \
  src/test/RequireAuthDevelopment.test.tsx \
  src/test/RequireAuth.test.tsx \
  src/test/LoginForm.test.tsx \
  src/test/AuthProvider.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Restore local test-auth configuration**

Edit ignored `.env.local`:

```text
VITE_ENABLE_TEST_AUTH=true
```

Keep the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values,
remove `VITE_DISABLE_AUTH`, and do not commit `.env.local`.

- [ ] **Step 6: Provision the persistent two-member local household**

Read local keys from `supabase status -o env`, then run the existing seed script with:

```bash
eval "$(supabase status -o env)"
SUPABASE_URL="$API_URL" \
SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
npx tsx scripts/seed-household.ts \
  --name "🐰 & 🐧 Test" \
  --member "yongju@test.local:household123:Yongju" \
  --member "claire@test.local:household123:Claire"
```

Expected: both auth users exist, Yongju owns the household, and Claire joins through a redeemed invite. Re-running the same command reuses them.

- [ ] **Step 7: Verify real login and protected data access**

Start the worktree server:

```bash
PATH="/opt/homebrew/bin:$PATH" npm run dev
```

In the browser:

1. open `/calendar` with no saved session and confirm redirect to `/login`;
2. sign in as `yongju@test.local` with `household123`;
3. confirm redirect to Calendar;
4. confirm Settings shows `🐰 & 🐧 Test`, Yongju as owner, and Claire as the second member;
5. sign out and confirm protected routes redirect to Login.

- [ ] **Step 8: Remove obsolete demo-mode documents**

Delete only:

```text
docs/superpowers/specs/2026-07-25-persistent-local-demo-mode-design.md
docs/superpowers/plans/2026-07-25-persistent-local-demo-mode.md
```

Keep this focused restoration plan as the implementation record.

- [ ] **Step 9: Update the canonical handoff**

Update `progress.md` with:

- normal login restored;
- local test credentials and household name;
- manually entered local data persists between runs;
- no separate demo mode exists;
- web UI-fidelity correction remains next;
- Task 7 remains the first mobile/Expo task and has not started.

- [ ] **Step 10: Run full verification**

Run:

```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run
PATH="/opt/homebrew/bin:$PATH" npm run lint
PATH="/opt/homebrew/bin:$PATH" npm run build
PATH="/opt/homebrew/bin:$PATH" git diff --check
```

Expected: 0 test failures, ESLint exits 0, production build exits 0, and diff check is clean.

- [ ] **Step 11: Commit and report**

```bash
git add src/components/auth/RequireAuth.tsx \
  src/test/RequireAuthDevelopment.test.tsx \
  progress.md \
  docs/superpowers/plans/2026-07-25-restore-local-test-login.md \
  docs/superpowers/specs/2026-07-25-persistent-local-demo-mode-design.md \
  docs/superpowers/plans/2026-07-25-persistent-local-demo-mode.md
git commit -m "fix: restore authenticated local testing"
```

Report the exact credentials, household provisioning result, browser verification, test counts, and the unchanged Task 7 boundary.
