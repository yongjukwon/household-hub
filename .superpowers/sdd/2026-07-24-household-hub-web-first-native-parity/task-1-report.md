# Task 1 report — Shared foundation and domain contracts

## Implementation summary

- Added the internal pure-TypeScript `@household-hub/domain` package with one
  public index and focused `validation`, `money`, `notes`, `operations`,
  `queryKeys`, `calendar`, and `trips` modules.
- Added runtime validation and branded contracts for UUIDs, signed/positive
  safe-integer cents, uppercase ISO-shaped currencies, IANA timezones,
  revisions, ISO datetimes, restricted TenTap JSON, operation commands, and
  operation results.
- Added money formatting, viewer-timezone timed-event dates versus fixed
  all-day dates, and isolated trip-currency totals with no conversion.
- Declared the web and Expo packages as consumers, added the Vite/TypeScript
  resolution path, and added the supported Expo SDK 57 default Metro config.
  npm 11 rejects `workspace:*`, so both consumers use supported local `file:`
  references while the root still declares npm workspaces.
- No React UI, Supabase schema, migrations, or Task 2+ functionality changed.

## Files changed

- `packages/domain/package.json`, `packages/domain/tsconfig.json`, and the
  seven source modules plus their seven focused Vitest files.
- `package.json`, `package-lock.json`, `tsconfig.app.json`, and `vite.config.ts`.
- `mobile/package.json`, `mobile/package-lock.json`, and `mobile/metro.config.js`.
- `docs/superpowers/plans/2026-07-24-household-hub-web-first-native-parity.md`
  is included as requested.

## RED/GREEN TDD evidence

Each test file was written and executed before its production module existed.

| Contract | RED command/result | GREEN command/result |
| --- | --- | --- |
| Scalar validation | `npm test -- --run packages/domain/src/validation.test.ts` failed: `./index` could not resolve; an added invalid-date case also failed when JavaScript normalized `2026-02-30`. | Same command passed after the implementation and strict calendar-date check. |
| Money formatting | `npm test -- --run packages/domain/src/money.test.ts` failed: `formatMoney is not a function`. | Validation + money suite passed: 6 tests. |
| Rich notes | `npm test -- --run packages/domain/src/notes.test.ts` failed: `isRichNoteJson is not a function`. | Validation + money + notes suite passed: 8 tests. |
| Operations | `npm test -- --run packages/domain/src/operations.test.ts` failed: operation guards were not functions. | Four-module suite passed: 11 tests. |
| Query keys | `npm test -- --run packages/domain/src/queryKeys.test.ts` failed: `queryKeys` was undefined. | Five-module suite passed: 13 tests. |
| Calendar time | `npm test -- --run packages/domain/src/calendar.test.ts` failed: calendar guards were not functions. | Six-module suite passed: 16 tests. |
| Trip buckets | `npm test -- --run packages/domain/src/trips.test.ts` failed: aggregator was not a function. | All domain suite passed: 7 files, 18 tests. |

## Commands and results

- `npm install --package-lock-only --ignore-scripts` — passed after switching
  unsupported `workspace:*` references to `file:` references.
- `npx tsc -p packages/domain/tsconfig.json --noEmit` — passed.
- `npx tsc -p mobile/tsconfig.json --noEmit` — passed.
- `npm run build` — passed; Vite production bundle and PWA assets generated.
- `npm test -- --run` — passed: 34 files, 212 tests.
- `npm run lint` — passed.
- `git diff --check` — passed.

## Self-review

- Confirmed the index exports exactly the seven requested focused modules.
- Confirmed validation boundaries cover zero/positive cents, revision one,
  malformed UUIDs/currencies/zones, unsupported rich-note nodes/marks, invalid
  operation concurrency data, and empty conflict reasons.
- Confirmed calendar tests distinguish UTC timed viewing conversion from fixed
  all-day dates, and trip tests prove CAD/foreign totals are separate.
- Confirmed only the required new mobile config/package files are staged; the
  copied Expo scaffold and unrelated untracked reference material remain
  untouched.

## Concerns

- `npm install` reports 25 dependency vulnerabilities (13 moderate, 12 high);
  no dependency remediation was performed in this scoped contracts task.
- The existing production build retains Vite's large-chunk warning. This task
  does not touch web route bundling.
