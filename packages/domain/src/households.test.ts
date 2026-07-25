import { describe, expect, it } from 'vitest'
import {
  INVITE_TTL_DAYS,
  MAX_HOUSEHOLD_MEMBERS,
  READ_NOTIFICATION_TTL_DAYS,
  householdAdminActions,
  isDisplayName,
  isHouseholdAdminAction,
  isHouseholdAdminRequest,
  isHouseholdAdminResult,
  isHouseholdName,
  isInviteCode,
} from './index'

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'

describe('household admin constants', () => {
  it('fixes the two-member cap and invite/notification lifetimes', () => {
    expect(MAX_HOUSEHOLD_MEMBERS).toBe(2)
    expect(INVITE_TTL_DAYS).toBe(7)
    expect(READ_NOTIFICATION_TTL_DAYS).toBe(90)
  })
})

describe('field validators', () => {
  it('accepts trimmed non-empty names within bounds and rejects the rest', () => {
    expect(isDisplayName('Penguin')).toBe(true)
    expect(isHouseholdName('Rabbit & Penguin')).toBe(true)
    expect(isDisplayName('')).toBe(false)
    expect(isDisplayName('   ')).toBe(false)
    expect(isDisplayName('x'.repeat(81))).toBe(false)
    expect(isHouseholdName(42)).toBe(false)
  })

  it('accepts only url-safe invite codes of a sane length', () => {
    expect(isInviteCode('AbC0-_dEf9GhIjK1')).toBe(true)
    expect(isInviteCode('short')).toBe(false)
    expect(isInviteCode('has spaces and symbols!!')).toBe(false)
    expect(isInviteCode('x'.repeat(200))).toBe(false)
  })
})

describe('household admin action guard', () => {
  it('recognizes exactly the allowlisted actions', () => {
    for (const action of householdAdminActions) {
      expect(isHouseholdAdminAction(action)).toBe(true)
    }
    expect(isHouseholdAdminAction('ledger.year.clear')).toBe(false)
    expect(isHouseholdAdminAction('invite.forge')).toBe(false)
  })
})

describe('household admin request validation', () => {
  it('accepts a well-formed onboard request', () => {
    expect(
      isHouseholdAdminRequest({
        action: 'household.onboard',
        payload: { displayName: 'Penguin', householdName: 'Rabbit & Penguin' },
      }),
    ).toBe(true)
  })

  it('accepts redeem, revoke, transfer, remove, and deletion payloads', () => {
    expect(
      isHouseholdAdminRequest({
        action: 'invite.redeem',
        payload: { code: 'AbC0-_dEf9GhIjK1', displayName: 'Rabbit' },
      }),
    ).toBe(true)
    expect(
      isHouseholdAdminRequest({
        action: 'invite.revoke',
        payload: { inviteId: UUID_A },
      }),
    ).toBe(true)
    expect(
      isHouseholdAdminRequest({
        action: 'ownership.transfer',
        payload: { toUserId: UUID_B },
      }),
    ).toBe(true)
    expect(
      isHouseholdAdminRequest({
        action: 'member.remove',
        payload: { memberUserId: UUID_B },
      }),
    ).toBe(true)
    expect(
      isHouseholdAdminRequest({ action: 'invite.create', payload: {} }),
    ).toBe(true)
    expect(
      isHouseholdAdminRequest({ action: 'account.delete', payload: {} }),
    ).toBe(true)
    expect(
      isHouseholdAdminRequest({
        action: 'household.delete',
        payload: { confirmHouseholdName: 'Rabbit & Penguin' },
      }),
    ).toBe(true)
  })

  it('rejects unknown actions, wrong-typed fields, and extra keys', () => {
    expect(
      isHouseholdAdminRequest({ action: 'invite.forge', payload: {} }),
    ).toBe(false)
    expect(
      isHouseholdAdminRequest({
        action: 'invite.revoke',
        payload: { inviteId: 'not-a-uuid' },
      }),
    ).toBe(false)
    // extra key beyond the action's strict schema
    expect(
      isHouseholdAdminRequest({
        action: 'invite.create',
        payload: { unexpected: true },
      }),
    ).toBe(false)
    expect(
      isHouseholdAdminRequest({
        action: 'household.onboard',
        payload: {
          displayName: 'Penguin',
          householdName: 'Home',
          extra: 1,
        },
      }),
    ).toBe(false)
  })
})

describe('household admin result guard', () => {
  it('accepts ok and rejected shapes and refuses malformed ones', () => {
    expect(isHouseholdAdminResult({ status: 'ok' })).toBe(true)
    expect(
      isHouseholdAdminResult({ status: 'ok', details: { inviteId: UUID_A } }),
    ).toBe(true)
    expect(
      isHouseholdAdminResult({
        status: 'rejected',
        code: 'household_full',
        reason: 'A household allows at most two members.',
        details: {},
      }),
    ).toBe(true)
    expect(isHouseholdAdminResult({ status: 'ok', details: 5 })).toBe(false)
    expect(isHouseholdAdminResult({ status: 'nope' })).toBe(false)
    expect(
      isHouseholdAdminResult({ status: 'rejected', code: '', reason: 'x', details: {} }),
    ).toBe(false)
  })
})
