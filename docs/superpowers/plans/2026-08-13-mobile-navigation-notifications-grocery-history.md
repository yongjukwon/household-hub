# Mobile Navigation, Schedule Notifications, and Grocery Price Tracking

## Global Constraints

- Preserve web behavior and unrelated changes.
- Keep Schedule permanently first and More permanently fifth.
- Store synchronized preferences through durable `settings.update` operations with validated defaults and optimistic overlays.
- In-app Schedule activity is independent of the OS push setting; reminder deliveries never appear as in-app activity.
- Grocery price history represents purchases, not merely entered prices. Unit price is the exact total-price/quantity ratio and is rounded only for display.
- Retain legacy web payload and history compatibility.
- Use test-driven development and run focused tests before the full verification suite.

## Task 1: Configurable Navigation and Shared App Chrome

- Add a shared app-chrome provider so screens register centered titles and contextual actions.
- Root pages show a 40x40 sage Add button at top-right; Schedule also shows the notification bell immediately to its left. Remove root-page floating Add buttons.
- Detail pages show Back, centered dynamic entity title, and Edit where supported. Inline editing uses Cancel, centered title, and Save. Trip Edit continues opening its full edit sheet.
- Use grocery-list name, note title, trip name, and titles such as `2026 Budget`; remove duplicate body titles.
- Let users select and order three destinations from Groceries, Ledger, Notes, and Trips. Default is Schedule, Groceries, Ledger, Trips, More.
- More uses an ellipsis icon and label, opens an anchored menu containing the omitted destination and Settings, and remains active while the omitted route is open.
- Add a Settings editor with Move Up, Move Down, Replace, live preview, and one Save action.
- Read and save the ordered three-item preference through `settings.update`; malformed values use the default. Include optimistic synchronization and save-failure behavior.
- Test centered root/detail/edit states, contextual actions, default/custom ordering, More, omitted-route active state, preview, synchronization, and save failure.

## Task 2: Schedule Activity Popover and Durable Notification Operations

- Show the bell only on Schedule and replace the notification page with a scrollable popover anchored beneath it.
- Retain read and unread calendar activity indefinitely until manually removed. Exclude reminder rows.
- Unread activity uses a red dot, stronger text, emphasized surface, and accessibility `Unread`; read activity is muted.
- Support individual Remove and confirmed Clear all through durable `notification.delete` and `notification.clear` operations.
- Tapping create/update activity marks it read and opens the event. Tapping deleted-event activity marks it read without navigation.
- Opening an event directly or from an OS notification marks all activity for that event read.
- Show unread indicators on Schedule tab and bell. Calendar date dots are red for unread create/update, sage for ordinary events, red takes precedence, and dots never overlap the selected date circle. Event rows show New or Updated until read.
- Snapshot actor name, event title, date/time, timezone, and deletion details. Use copy such as `Claire added Dinner` and `Friday at 6:00 PM`.
- Keep reminder notifications push-only and retain separate housekeeping for hidden reminder-delivery rows.
- Test all popover, read/unread, removal, clear, navigation, deletion, indicator, calendar-dot, event badge, and reminder-exclusion behavior.

## Task 3: Grocery Purchase Entry and Inline Price History

- Remove the price field beside Add Item, remove Last paid and suggestion price autofill, and make Add Item accept only a name.
- Edit Item contains Name, Quantity, and Price (CAD), where Price is total paid. Quantity accepts positive decimals. Preserve quantity and total and calculate unit price internally.
- Checking a priced item records the purchase immediately. Checking an unpriced item opens a prompt with Quantity and Price, Save price and check, Check without price, and Cancel.
- Check without price opens a warning that the purchase will not enter history, with a Don't show this warning again option synchronized through the user profile. Suppression skips only this confirmation.
- Add History beside Edit on every item and render history inline immediately below the item, one panel at a time; remove the list footer history.
- History rows show calculated per-item price, quantity, total paid, store-name snapshot, and purchase date.
- With six or more records show three cheapest and three most expensive by unit price; otherwise show every record once.
- Test validation, unit calculation, priced/unpriced flows, suppression, inline placement, one-at-a-time expansion, and ranking.

## Task 4: Shared Contracts, Database Migration, and Server Rules

- Add a shared `MobileDestinationKey` and validated three-item navigation tuple.
- Extend profiles with ordered mobile navigation and suppress-unpriced-warning preferences. Extend `settings.update` validation, application, and optimistic profile overlays.
- Add positive purchase quantity and total-price fields to grocery item operations while retaining legacy payload compatibility. Preserve legacy quantity/price columns and backfill canonical fields safely.
- Extend history with store snapshot, source item, purchase occurrence, purchase quantity, and total price. Legacy history is quantity 1 and total equal to its existing price.
- Implement server-side purchase history insertion, late creation using original checked date, update/merge without changing purchase date, ownership, idempotency, and same-name/list/unit-price deduplication. Same store/same price advances the existing row date; different price or store stays separate. Keep item and occurrence metadata but do not dedupe by item UUID alone. History survives item/list deletion.
- Add `notification.delete` and `notification.clear` to shared operation types, entity mapping, validation, dispatch, ownership checks, replay compatibility, and optimistic overlays.
- Snapshot calendar activity fields in the notification trigger and stop cleanup from deleting visible calendar activity while retaining reminder housekeeping.
- Add database tests for constraints, ownership, idempotency, history merging, notification snapshots, and cleanup operations.

## Task 5: Household Purchase History Page

Added after Task 4 at the human partner's request; mobile only.

- Add a `Purchase history` page at `app/purchase-history.tsx`, reached from a third More-menu row beneath the omitted destination and Settings. It is a standalone route like `/settings`, not a tab destination, so Task 1's configurable-three-destinations contract is unchanged.
- The page lists every distinct purchased item in the household, aggregated across all lists by normalized name, newest purchase first. Each row shows the display name, the most recent purchase date, and that item's latest unit price.
- A search bar filters the list by item name. Matching is case- and accent-insensitive and uses the same normalization the server records history under.
- Tapping a row opens that item's detail history: its purchase occurrences from the last 365 days, newest first, each showing date, store/list snapshot, quantity, total paid, and unit price. The 365-day window applies to the detail view only — the searchable list still shows every item ever purchased, so an older item remains findable.
- Unit price is the exact total-price/quantity ratio, rounded only for display, consistent with Task 3 and Task 4.
- History rows survive item and list deletion, so the page must render rows whose source item or list no longer exists without crashing or showing a blank name.
- Empty states: no purchases at all, no search matches, and an item with no purchases inside the 365-day window.
- Test list aggregation and ordering, search filtering and normalization, the 365-day detail boundary, deleted-source rendering, and all three empty states.

## Task 6: Full Verification and Native Manual QA

- Run `npm test -- --runInBand` and `npm run typecheck` from `mobile/`.
- Run root domain/application tests and `npm run test:functions`.
- Run `supabase test db --local`.
- Manually verify iOS light and dark modes on compact screens with long titles, offline operations, relaunch persistence, warning suppression, inline history placement, calendar-dot clearance, and the Purchase history page's search and detail views.
