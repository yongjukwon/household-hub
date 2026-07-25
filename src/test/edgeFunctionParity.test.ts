import { describe, expect, it } from 'vitest'

import {
  householdAdminActions,
  isDisplayName,
  isHouseholdAdminRequest,
  isInviteCode,
  READ_NOTIFICATION_TTL_DAYS,
  reminderLeadMinutes,
  reminderPresets,
} from '@household-hub/domain'

import { reminderLeadMinutesByPreset } from '../../supabase/functions/_shared/reminders'
import { READ_NOTIFICATION_TTL_DAYS as edgeReadNotificationTtlDays } from '../../supabase/functions/_shared/retention'
import {
  householdAdminActions as edgeAdminActions,
  isDisplayName as edgeIsDisplayName,
  isInviteCode as edgeIsInviteCode,
  planAdminAction,
} from '../../supabase/functions/household-admin/actions'

/**
 * The Edge Functions run on Deno and cannot import the workspace package, so
 * they carry their own copies of a few contract details. These tests fail if
 * the copies ever drift from the shared domain package.
 */
describe('edge function parity with @household-hub/domain', () => {
  it('agrees on the reminder presets and their lead times', () => {
    expect(Object.keys(reminderLeadMinutesByPreset).sort()).toEqual(
      [...reminderPresets].sort(),
    )

    for (const preset of reminderPresets) {
      expect(reminderLeadMinutesByPreset[preset]).toBe(
        reminderLeadMinutes(preset),
      )
    }
  })

  it('agrees on the household administration action list', () => {
    expect([...edgeAdminActions]).toEqual([...householdAdminActions])
  })

  it('agrees on display-name and invite-code validation', () => {
    const cases: unknown[] = [
      'Yongju',
      ' ',
      '',
      'x'.repeat(80),
      'x'.repeat(81),
      42,
      null,
    ]
    for (const value of cases) {
      expect(edgeIsDisplayName(value)).toBe(isDisplayName(value))
    }

    const codes: unknown[] = [
      'abcdefghijklmnop-_ABCDEFGH',
      'short',
      'has spaces in it here',
      'x'.repeat(65),
      null,
    ]
    for (const value of codes) {
      expect(edgeIsInviteCode(value)).toBe(isInviteCode(value))
    }
  })

  it('accepts and refuses the same administration requests as the domain guard', () => {
    const requests: unknown[] = [
      { action: 'invite.create', payload: {} },
      {
        action: 'invite.revoke',
        payload: { inviteId: 'f0f0a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b' },
      },
      { action: 'invite.revoke', payload: { inviteId: 'nope' } },
      { action: 'invite.revoke', payload: {} },
      {
        action: 'invite.redeem',
        payload: { code: 'abcdefghijklmnop-_ABCDEFGH', displayName: 'Partner' },
      },
      {
        action: 'household.onboard',
        payload: { displayName: 'Yongju', householdName: 'Home' },
      },
      { action: 'household.onboard', payload: { displayName: 'Yongju' } },
      { action: 'household.delete', payload: { confirmHouseholdName: 'Home' } },
      { action: 'household.delete', payload: {} },
      { action: 'account.delete', payload: {} },
      { action: 'account.delete', payload: { confirm: true } },
      {
        action: 'ownership.transfer',
        payload: { toUserId: '6b6f9e1a-1f8a-4a2f-9c3d-2b0c8f5d1e77' },
      },
      {
        action: 'member.remove',
        payload: { memberUserId: '6b6f9e1a-1f8a-4a2f-9c3d-2b0c8f5d1e77' },
      },
      { action: 'household.nuke', payload: {} },
      null,
    ]

    for (const request of requests) {
      expect(planAdminAction(request).ok).toBe(isHouseholdAdminRequest(request))
    }
  })

  it('uses the shared read-notification retention window', () => {
    expect(edgeReadNotificationTtlDays).toBe(READ_NOTIFICATION_TTL_DAYS)
  })
})
