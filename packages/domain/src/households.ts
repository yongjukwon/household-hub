import { isRecord, isUuid } from './validation'

/** A household has at most two active members (owner + partner). */
export const MAX_HOUSEHOLD_MEMBERS = 2
/** Invite links/codes are single-use and expire after this many days. */
export const INVITE_TTL_DAYS = 7
/** Read notification inbox items are purged after this many days. */
export const READ_NOTIFICATION_TTL_DAYS = 90

const NAME_MAX = 80
const inviteCodePattern = /^[A-Za-z0-9_-]{16,64}$/

/**
 * Household administration actions. Unlike durable `OperationCommand`s (offline
 * queue), these are synchronous, online-only, and executed by security-definer
 * RPCs / service-role Edge Functions — so they are modeled separately, not in
 * `operationTypes`.
 */
export const householdAdminActions = [
  'household.onboard',
  'invite.create',
  'invite.revoke',
  'invite.redeem',
  'ownership.transfer',
  'member.remove',
  'account.delete',
  'household.delete',
] as const

export type HouseholdAdminAction = (typeof householdAdminActions)[number]

export function isHouseholdAdminAction(
  value: unknown,
): value is HouseholdAdminAction {
  return (
    typeof value === 'string' &&
    householdAdminActions.includes(value as HouseholdAdminAction)
  )
}

export function isDisplayName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 1 &&
    value.trim().length <= NAME_MAX
  )
}

export function isHouseholdName(value: unknown): value is string {
  return isDisplayName(value)
}

export function isInviteCode(value: unknown): value is string {
  return typeof value === 'string' && inviteCodePattern.test(value)
}

export type HouseholdAdminRequest = {
  action: HouseholdAdminAction
  payload: Record<string, unknown>
}

// Per-action strict payload schema: exact key set + validator per key.
const payloadSchemas: Record<
  HouseholdAdminAction,
  Record<string, (value: unknown) => boolean>
> = {
  'household.onboard': {
    displayName: isDisplayName,
    householdName: isHouseholdName,
  },
  'invite.create': {},
  'invite.revoke': { inviteId: isUuid },
  'invite.redeem': { code: isInviteCode, displayName: isDisplayName },
  'ownership.transfer': { toUserId: isUuid },
  'member.remove': { memberUserId: isUuid },
  'account.delete': {},
  'household.delete': { confirmHouseholdName: isHouseholdName },
}

function matchesSchema(
  schema: Record<string, (value: unknown) => boolean>,
  payload: Record<string, unknown>,
): boolean {
  const allowed = Object.keys(schema)
  const actual = Object.keys(payload)
  if (actual.length !== allowed.length) return false
  return allowed.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(payload, key) &&
      schema[key](payload[key]),
  )
}

export function isHouseholdAdminRequest(
  value: unknown,
): value is HouseholdAdminRequest {
  if (!isRecord(value) || !isHouseholdAdminAction(value.action)) return false
  if (!isRecord(value.payload)) return false
  return matchesSchema(payloadSchemas[value.action], value.payload)
}

export type HouseholdAdminResult =
  | { status: 'ok'; details?: Record<string, unknown> }
  | {
      status: 'rejected'
      code: string
      reason: string
      details: Record<string, unknown>
    }

export function isHouseholdAdminResult(
  value: unknown,
): value is HouseholdAdminResult {
  if (!isRecord(value)) return false
  if (value.status === 'ok') {
    return value.details === undefined || isRecord(value.details)
  }
  if (value.status === 'rejected') {
    return (
      typeof value.code === 'string' &&
      value.code.trim().length > 0 &&
      typeof value.reason === 'string' &&
      value.reason.trim().length > 0 &&
      isRecord(value.details)
    )
  }
  return false
}
