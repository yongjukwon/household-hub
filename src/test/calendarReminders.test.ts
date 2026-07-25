import { describe, expect, it } from 'vitest'

import {
  reminderFromDatabase,
  reminderToDatabase,
} from '@/features/calendar/reminders'

describe('calendar reminder persistence adapters', () => {
  it('maps the UI at-time spelling to the database contract', () => {
    expect(reminderToDatabase('at-time')).toBe('at_time')
  })

  it('maps the database at_time spelling back to the UI model', () => {
    expect(reminderFromDatabase('at_time')).toBe('at-time')
  })

  it('preserves the other supported reminder presets', () => {
    for (const preset of ['10m', '1h', '1d', '1w'] as const) {
      expect(reminderToDatabase(preset)).toBe(preset)
      expect(reminderFromDatabase(preset)).toBe(preset)
    }
  })

  it('does not persist none and ignores unknown database values', () => {
    expect(reminderToDatabase('none')).toBeNull()
    expect(reminderFromDatabase('none')).toBeNull()
    expect(reminderFromDatabase('30m')).toBeNull()
  })
})
