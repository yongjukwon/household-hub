/**
 * Read inbox notifications are purged after this many days; unread items are
 * kept indefinitely.
 *
 * Mirrors `READ_NOTIFICATION_TTL_DAYS` in `@household-hub/domain`; the edge
 * runtime cannot import the workspace package, so
 * `src/test/edgeFunctionParity.test.ts` asserts the two agree.
 */
export const READ_NOTIFICATION_TTL_DAYS = 90
