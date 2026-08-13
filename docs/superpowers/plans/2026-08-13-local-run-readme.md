# Local Run README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root README that documents how to configure, run, test, and sign in to the web and mobile applications locally.

**Architecture:** Keep all shared setup in one root document, then split execution instructions into web and mobile sections. Derive every command, environment variable, URL, and test credential from current repository configuration or committed project records.

**Tech Stack:** Markdown, npm workspaces, Vite, Expo SDK 57, Supabase CLI

## Global Constraints

- Document Node.js 20.19 or newer.
- Use local Supabase API port `55321`.
- Require `VITE_ENABLE_TEST_AUTH=true` for web password login.
- Require `EXPO_PUBLIC_ENABLE_TEST_AUTH=true` for mobile password login.
- State that Expo Go is unsupported; mobile uses a development build.
- Never include a service-role key or OAuth secret.

---

### Task 1: Root local-development README

**Files:**

- Create: `README.md`
- Verify: `package.json`
- Verify: `mobile/package.json`
- Verify: `.env.example`
- Verify: `mobile/.env.example`
- Verify: `supabase/config.toml`
- Verify: `scripts/seed-household.ts`

**Interfaces:**

- Consumes: npm scripts, Supabase ports, public environment variable names, seed-script CLI, and local test credentials.
- Produces: a single onboarding entry point for developers running either client.

- [x] **Step 1: Write the README**

Create `README.md` with these sections: overview, repository layout,
prerequisites, shared local setup, web execution, mobile execution, test
credentials, verification commands, and stopping local services.

- [x] **Step 2: Verify documented references**

Run:

```bash
rg -n '"(dev|build|lint|test|test:functions|ios|android|typecheck)"|port = 55321|VITE_ENABLE_TEST_AUTH|EXPO_PUBLIC_ENABLE_TEST_AUTH' package.json mobile/package.json supabase/config.toml .env.example mobile/app/login.tsx README.md
```

Expected: every README command, port, and test-auth variable has a matching
repository definition.

- [x] **Step 3: Check Markdown formatting and Git whitespace**

Run:

```bash
npx prettier --check README.md
git diff --check
```

Expected: both commands exit successfully.

- [x] **Step 4: Commit**

```bash
git add README.md docs/superpowers/plans/2026-08-13-local-run-readme.md
git commit -m "docs: add local web and mobile setup"
```
