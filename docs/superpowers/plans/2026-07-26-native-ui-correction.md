# Native UI correction implementation plan

> Execute in one approved pass. Preserve the dirty worktree and unrelated
> reference files.

## 1. Shared add action and Calendar spacing

- Add a reusable `FloatingActionButton` with semantic label, shared tokens,
  safe positioning, and a minimum 48-point target.
- Add component coverage for accessibility and press behavior.
- Move Calendar, Groceries, Notes, and Trips creation triggers to the shared
  button.
- Increase Calendar date rows to the reference-aligned 48-point height and
  retain absolute event-dot positioning.

## 2. Grocery item actions

- Add a failing interaction test for separate edit and delete controls.
- Render `PencilIcon` and `TrashIcon` controls per item.
- Add item-specific confirmation state and call the existing
  `deleteGroceryItem` operation only after confirmation.

## 3. Ledger pending-year hydration

- Add pure tests for a helper that supplies twelve temporary month rows only
  when a known Statement year has no server months.
- Use the hydrated data in the Budget detail and annual summary.
- Keep the true missing-year state unchanged.

## 4. Notes editor visual system

- Add toolbar structure coverage.
- Move the custom toolbar above the WebView and make it horizontally
  scrollable.
- Apply shared tokens to the editor frame, toolbar, controls, active states,
  dividers, and WebView container.

## 5. Verification and handoff

- Run targeted Jest tests while implementing.
- Run mobile tests, mobile typecheck, repository lint, and repository
  typecheck/build commands appropriate to the changed scope.
- Record the completed correction in `docs/superpowers/progress-detail.md` and
  keep `progress.md` concise with current state and remaining device checks.
