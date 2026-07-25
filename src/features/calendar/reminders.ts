import type { ReminderPreset } from '@household-hub/domain'

export type DatabaseReminderPreset = 'at_time' | '10m' | '1h' | '1d' | '1w'

/** Converts the UI/domain spelling to the value accepted by Supabase. */
export function reminderToDatabase(
  preset: ReminderPreset,
): DatabaseReminderPreset | null {
  if (preset === 'none') return null
  return preset === 'at-time' ? 'at_time' : preset
}

/** Converts a stored reminder into the UI/domain spelling. */
export function reminderFromDatabase(value: string): ReminderPreset | null {
  if (value === 'at_time') return 'at-time'
  if (value === '10m' || value === '1h' || value === '1d' || value === '1w') {
    return value
  }
  return null
}
