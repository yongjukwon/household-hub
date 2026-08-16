export type CalendarDotTone = 'unread' | 'ordinary' | 'none'

/** Red unread activity wins when a date also has an ordinary event dot. */
export function calendarDotTone(
  hasEvent: boolean,
  hasUnreadActivity: boolean,
): CalendarDotTone {
  if (hasUnreadActivity) return 'unread'
  return hasEvent ? 'ordinary' : 'none'
}
