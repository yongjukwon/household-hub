// Request validation and RPC mapping for the household-admin function.
//
// Mirrors the `householdAdminActions` contract in `@household-hub/domain`; the
// edge runtime cannot import the workspace package, so
// `src/test/edgeFunctionParity.test.ts` asserts the two agree on the
// action list and payload shapes.

import type { Json } from '../_shared/json.ts'

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

const NAME_MAX = 80
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const inviteCodePattern = /^[A-Za-z0-9_-]{16,64}$/

export function isUuid(value: unknown): boolean {
  return typeof value === 'string' && uuidPattern.test(value)
}

export function isDisplayName(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.trim().length >= 1 &&
    value.trim().length <= NAME_MAX
  )
}

export function isInviteCode(value: unknown): boolean {
  return typeof value === 'string' && inviteCodePattern.test(value)
}

const payloadSchemas: Record<
  HouseholdAdminAction,
  Record<string, (value: unknown) => boolean>
> = {
  'household.onboard': {
    displayName: isDisplayName,
    householdName: isDisplayName,
  },
  'invite.create': {},
  'invite.revoke': { inviteId: isUuid },
  'invite.redeem': { code: isInviteCode, displayName: isDisplayName },
  'ownership.transfer': { toUserId: isUuid },
  'member.remove': { memberUserId: isUuid },
  'account.delete': {},
  'household.delete': { confirmHouseholdName: isDisplayName },
}

/**
 * What the function must do for a valid request.
 *
 * `rpc` runs as the caller so `auth.uid()` and RLS still apply. The other two
 * kinds need effects SQL cannot reach on its own — deleting the `auth.users`
 * row, and checking the typed household name against the stored one.
 */
export type AdminPlan =
  | { kind: 'rpc'; name: string; args: Record<string, Json> }
  | { kind: 'account.delete' }
  | { kind: 'household.delete'; confirmHouseholdName: string }

export type AdminPlanResult =
  | { ok: true; action: HouseholdAdminAction; plan: AdminPlan }
  | { ok: false; code: string; reason: string }

/**
 * Validates `{ action, payload }` and maps it to the work to perform. Payloads
 * are strict: exactly the schema's keys, each passing its validator.
 */
export function planAdminAction(body: unknown): AdminPlanResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      ok: false,
      code: 'invalid_body',
      reason: 'Expected a JSON object body.',
    }
  }

  const { action, payload } = body as Record<string, unknown>

  if (
    typeof action !== 'string' ||
    !householdAdminActions.includes(action as HouseholdAdminAction)
  ) {
    return {
      ok: false,
      code: 'unknown_action',
      reason: 'Unsupported administration action.',
    }
  }
  const known = action as HouseholdAdminAction

  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return {
      ok: false,
      code: 'invalid_payload',
      reason: 'Expected an object payload.',
    }
  }
  const fields = payload as Record<string, unknown>

  const schema = payloadSchemas[known]
  const allowed = Object.keys(schema)
  if (Object.keys(fields).length !== allowed.length) {
    return {
      ok: false,
      code: 'invalid_payload',
      reason: `Payload for ${known} must contain exactly: ${allowed.join(', ') || '(no fields)'}.`,
    }
  }
  for (const key of allowed) {
    if (
      !Object.prototype.hasOwnProperty.call(fields, key) ||
      !schema[key](fields[key])
    ) {
      return {
        ok: false,
        code: 'invalid_payload',
        reason: `Payload field "${key}" is missing or invalid.`,
      }
    }
  }

  return { ok: true, action: known, plan: planFor(known, fields) }
}

function planFor(
  action: HouseholdAdminAction,
  fields: Record<string, unknown>,
): AdminPlan {
  switch (action) {
    case 'household.onboard':
      return {
        kind: 'rpc',
        name: 'onboard_household',
        args: {
          display_name: fields.displayName as string,
          household_name: fields.householdName as string,
        },
      }
    case 'invite.create':
      return { kind: 'rpc', name: 'create_household_invite', args: {} }
    case 'invite.revoke':
      return {
        kind: 'rpc',
        name: 'revoke_household_invite',
        args: { invite_id: fields.inviteId as string },
      }
    case 'invite.redeem':
      return {
        kind: 'rpc',
        name: 'redeem_household_invite',
        args: {
          code: fields.code as string,
          display_name: fields.displayName as string,
        },
      }
    case 'ownership.transfer':
      return {
        kind: 'rpc',
        name: 'transfer_household_ownership',
        args: { target_user_id: fields.toUserId as string },
      }
    case 'member.remove':
      return {
        kind: 'rpc',
        name: 'remove_household_member',
        args: { target_user_id: fields.memberUserId as string },
      }
    case 'account.delete':
      return { kind: 'account.delete' }
    case 'household.delete':
      return {
        kind: 'household.delete',
        confirmHouseholdName: fields.confirmHouseholdName as string,
      }
  }
}

/** The typed confirmation must match the stored name, ignoring case and padding. */
export function confirmationMatches(typed: string, actual: string): boolean {
  return typed.trim().toLowerCase() === actual.trim().toLowerCase()
}
