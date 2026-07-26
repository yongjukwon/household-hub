# Native UI correction design

**Date:** 2026-07-26
**Scope:** Expo application only

## Goal

Correct five mobile usability gaps without changing the approved information
architecture, database contract, or offline command model.

## Approved behavior

### Calendar

- Increase every month-grid date cell from 38 to 48 points.
- Keep the date number vertically centered and the event dot absolutely
  positioned so dates with events do not shift.

### Groceries

- Replace the text `Edit` action on every item with a pencil icon.
- Add a separate trash icon beside it.
- Tapping the trash icon opens a destructive confirmation naming the item.
- Confirming queues the existing `grocery.item.delete` operation. Cancelling
  leaves the item unchanged.

### Ledger

- A locally created Statement year must immediately open as a usable Budget
  page, including all twelve month choices, even before its queued create
  operation reaches Supabase.
- The client fills only the missing month shell. It does not invent
  transactions, categories, limits, or server revisions.
- Once Supabase returns the real twelve month rows, those rows replace the
  temporary shell.
- A genuinely unknown/deleted year still shows `Statement not found`.

### Notes

- Present the restricted TenTap controls in a compact horizontal toolbar above
  the editor.
- Use the shared canvas, card, alternate-card, line, ink, muted, accent, radius,
  and shadow tokens.
- Keep Body, Heading 1–3, bullet list, numbered list, checklist, undo, and redo
  only. The saved JSON schema is unchanged.

### Root-page add actions

- Calendar, Groceries, Notes, and Trips share one 54-point circular floating
  add button.
- It sits 20 points from the right and 16 points above the tab content's bottom
  edge. Because the tab bar is a docked sibling, the button appears directly
  above the navigation instead of overlapping it.
- Root lists reserve bottom space so the button never covers their final row.
- Existing bottom sheets and create behavior remain unchanged.

## Non-goals

- No web UI changes.
- No Supabase migration or RPC changes.
- No changes to the five-tab navigation.
- No automatic budget/category data beyond the already-approved twelve empty
  months created with a Statement year.
