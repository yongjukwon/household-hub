# Household Hub Mobile-First Implementation Progress

**Last updated:** 2026-07-25

**Canonical continuation file:** `progress.md`

**Implementation branch:** `codex/household-hub-mobile-first`

**Implementation worktree:** `/Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first`
**Current HEAD:** `f86f4c0 test: cover two-device ordering through the queue`
**Last review-clean baseline:** `d1f3e30` (Tasks 1–2, independent review).
Tasks 3 and 4 are complete (self-reviewed); Task 5 is next.

This file is the source of truth for continuing the approved web-first
Household Hub rebuild. Current Git state and fresh verification results take
precedence if this file ever becomes stale.

## How to resume safely

1. Work from:

   ```bash
   cd /Users/conlegs/dev/household-hub/.worktrees/household-hub-mobile-first
   ```

2. Read, in order:

   - `progress.md`
   - `docs/superpowers/plans/2026-07-24-household-hub-web-first-native-parity.md`
   - `docs/superpowers/specs/2026-07-24-web-first-household-hub-redesign.md`
   - `docs/mobile-design-reference/README.md` (+ `Household Hub Mobile.dc.html`) — drives Task 5+ UI
   - `CLAUDE.md`
   - `docs/superpowers/progress-detail.md` — deep per-task history (optional)
   - `mobile/AGENTS.md` before changing Expo code

3. Reconcile the repository before editing:

   ```bash
   git status --short
   git log --oneline -12
   ```

4. Preserve the existing untracked reference/scaffold files unless the active
   task explicitly brings them into scope:

   - `DEPLOYMENT.md`
   - `docs/mobile-design-reference/`
   - `docs/mobile-implementation-handoff.md`
   - the still-untracked files under `mobile/`

5. Resume at **Task 5 (responsive web shell and visual system)**. Tasks 1–4
   are complete, committed, and verified — do not redo them.

6. **Task 5 is next** and is driven by the design reference in
   `docs/mobile-design-reference/`. Per-task checkpoint discipline applies:
   commit + verify each sub-checkpoint, and report at the task boundary.
   (Tasks 3-4 are complete; the earlier Task 3→4 pre-approval directive no
   longer applies.)

## Approved product direction

- Rebuild and validate the web application first.
- Phone web and native follow the supplied mobile design reference.
- Desktop web keeps a wider left navigation pane with the same behavior.
- Primary destinations are Calendar, Groceries, Ledger, Notes, and Trips.
- Calendar is the default destination. There is no Home destination.
- The header contains the rabbit/penguin identity, Notifications, and Settings.
- Notes retain multiple named documents.
- Web, iOS, and Android use one Supabase backend and one shared domain contract.
- Native targets portrait phones only.
- Production application data will start empty, but the production reset must
  not run until a separate release-time approval.

## Progress summary

| Task | Status | Completion |
| --- | --- | --- |
| 1. Shared foundation and domain contracts | Complete | Review-clean at `ffc3c01` |
| 2. Supabase schema and operation RPC | Complete | Review-clean at `d1f3e30` |
| 3. Identity, notifications, jobs, deployment config | Complete | Verified at `24a5b39` (self-review; no independent review agent) |
| 4. Durable web operation queue | Complete | Verified at `f86f4c0`; its UI surface lands with Task 5 |
| 5. Responsive web shell and visual system | Pending | Not started |
| 6. Web feature flows | Pending | Not started |
| 7. Expo foundation and offline data layer | Pending | Not started |
| 8. Expo feature parity and visual implementation | Pending | Not started |
| 9. Reset procedure, E2E verification, release handoff | Pending | Not started |


## Environment, constraints & risks (condensed)

- **Run from this worktree** (`codex/household-hub-mobile-first`), not the main
  checkout — different branch.
- **Prefix Node commands with `PATH="/opt/homebrew/bin:$PATH"`** — the Rosetta
  x64 node breaks `npm test`/`build` (arch mismatch); arm64 runs clean. Supabase
  CLI must be ≥ 2.109.
- **Migrations go to both DBs separately:** `supabase db push` (cloud) and
  `supabase db reset` / `migration up` (local).
- **Nothing is deployed** — all verification is local; no hosted Supabase,
  Vercel, or EAS build touched. Production data untouched. **Do not run the
  production reset** (Task 9; needs explicit release approval).
- **No independent review agent ran for Tasks 3–4** (session directive: no
  subagents) — self-review + live end-to-end only. `/code-review` on this branch
  is the recommended pre-merge follow-up.
- **Legacy membership preflight:** the one-user/one-household unique constraint
  fails if legacy data has a user in multiple households — resolve before a
  hosted deploy.
- Carried-forward risks (permanently-failing push batch, Expo push not yet
  exercised against Expo's servers, live two-client Realtime) are in the archive.

## Full detail

Architecture diagrams, per-task narratives, per-task verification baselines,
reviews, and the original task scope now live in
`docs/superpowers/progress-detail.md`. Current git state + fresh verification
always take precedence over both files.
