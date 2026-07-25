import { assertEquals } from 'jsr:@std/assert@1'

import { confirmationMatches, planAdminAction } from './actions.ts'

const USER_ID = '6b6f9e1a-1f8a-4a2f-9c3d-2b0c8f5d1e77'
const INVITE_ID = 'f0f0a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b'
const CODE = 'abcdefghijklmnop-_ABCDEFGH'

Deno.test('an unknown action is refused', () => {
  assertEquals(planAdminAction({ action: 'household.nuke', payload: {} }), {
    ok: false,
    code: 'unknown_action',
    reason: 'Unsupported administration action.',
  })
})

Deno.test('a non-object body or payload is refused', () => {
  assertEquals(planAdminAction(null).ok, false)
  assertEquals(planAdminAction([]).ok, false)
  assertEquals(planAdminAction({ action: 'invite.create', payload: [] }), {
    ok: false,
    code: 'invalid_payload',
    reason: 'Expected an object payload.',
  })
})

Deno.test('extra payload keys are refused', () => {
  const result = planAdminAction({
    action: 'invite.revoke',
    payload: { inviteId: INVITE_ID, householdId: INVITE_ID },
  })
  assertEquals(result.ok, false)
  if (!result.ok) assertEquals(result.code, 'invalid_payload')
})

Deno.test('a payload field of the wrong type is refused', () => {
  for (const body of [
    { action: 'invite.revoke', payload: { inviteId: 'not-a-uuid' } },
    {
      action: 'invite.redeem',
      payload: { code: 'short', displayName: 'Yongju' },
    },
    { action: 'invite.redeem', payload: { code: CODE, displayName: '   ' } },
    {
      action: 'invite.redeem',
      payload: { code: CODE, displayName: 'x'.repeat(81) },
    },
    { action: 'ownership.transfer', payload: { toUserId: 42 } },
    { action: 'household.onboard', payload: { displayName: 'Yongju' } },
  ]) {
    const result = planAdminAction(body)
    assertEquals(
      result.ok,
      false,
      `expected ${JSON.stringify(body)} to be refused`,
    )
  }
})

Deno.test('onboarding maps to the RPC argument names', () => {
  assertEquals(
    planAdminAction({
      action: 'household.onboard',
      payload: { displayName: 'Yongju', householdName: 'Home' },
    }),
    {
      ok: true,
      action: 'household.onboard',
      plan: {
        kind: 'rpc',
        name: 'onboard_household',
        args: { display_name: 'Yongju', household_name: 'Home' },
      },
    },
  )
})

Deno.test('invite actions map to their RPCs', () => {
  assertEquals(planAdminAction({ action: 'invite.create', payload: {} }), {
    ok: true,
    action: 'invite.create',
    plan: { kind: 'rpc', name: 'create_household_invite', args: {} },
  })
  assertEquals(
    planAdminAction({
      action: 'invite.revoke',
      payload: { inviteId: INVITE_ID },
    }),
    {
      ok: true,
      action: 'invite.revoke',
      plan: {
        kind: 'rpc',
        name: 'revoke_household_invite',
        args: { invite_id: INVITE_ID },
      },
    },
  )
  assertEquals(
    planAdminAction({
      action: 'invite.redeem',
      payload: { code: CODE, displayName: 'Partner' },
    }),
    {
      ok: true,
      action: 'invite.redeem',
      plan: {
        kind: 'rpc',
        name: 'redeem_household_invite',
        args: { code: CODE, display_name: 'Partner' },
      },
    },
  )
})

Deno.test('membership actions map to their RPCs', () => {
  assertEquals(
    planAdminAction({
      action: 'ownership.transfer',
      payload: { toUserId: USER_ID },
    }),
    {
      ok: true,
      action: 'ownership.transfer',
      plan: {
        kind: 'rpc',
        name: 'transfer_household_ownership',
        args: { target_user_id: USER_ID },
      },
    },
  )
  assertEquals(
    planAdminAction({
      action: 'member.remove',
      payload: { memberUserId: USER_ID },
    }),
    {
      ok: true,
      action: 'member.remove',
      plan: {
        kind: 'rpc',
        name: 'remove_household_member',
        args: { target_user_id: USER_ID },
      },
    },
  )
})

Deno.test('account and household deletion need service-role handling', () => {
  assertEquals(planAdminAction({ action: 'account.delete', payload: {} }), {
    ok: true,
    action: 'account.delete',
    plan: { kind: 'account.delete' },
  })
  assertEquals(
    planAdminAction({
      action: 'household.delete',
      payload: { confirmHouseholdName: 'Home' },
    }),
    {
      ok: true,
      action: 'household.delete',
      plan: { kind: 'household.delete', confirmHouseholdName: 'Home' },
    },
  )
})

Deno.test(
  'the typed household name is compared leniently but not loosely',
  () => {
    assertEquals(confirmationMatches(' home ', 'Home'), true)
    assertEquals(confirmationMatches('HOME', 'Home'), true)
    assertEquals(confirmationMatches('Hom', 'Home'), false)
    assertEquals(confirmationMatches('', 'Home'), false)
  },
)

Deno.test('a payload is never passed through unvalidated to an RPC', () => {
  // Anything that reaches an RPC came from planFor, so injected keys such as a
  // household id can never ride along.
  const result = planAdminAction({
    action: 'invite.create',
    payload: {},
  })
  assertEquals(result.ok, true)
  if (result.ok && result.plan.kind === 'rpc') {
    assertEquals(Object.keys(result.plan.args), [])
  }
})
