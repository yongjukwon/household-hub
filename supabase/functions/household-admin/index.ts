// Household administration: onboarding, invites, ownership, membership, and
// the two deletions.
//
// Most actions are security-definer RPCs the client could call directly; they
// are routed through here so every administration path has one audited entry
// point, one result shape, and one place where the effects SQL cannot perform
// (removing an `auth.users` row) are attached to the same request.

import {
  guardMethod,
  jsonResponse,
  parseJsonObject,
  rejected,
  unexpectedError,
} from '../_shared/http.ts'
import {
  callerClient,
  type Json,
  serviceClient,
  SupabaseRestError,
} from '../_shared/supabase.ts'
import { confirmationMatches, planAdminAction } from './actions.ts'

Deno.serve(async (request) => {
  const guard = guardMethod(request)
  if (guard) return guard

  try {
    const body = await parseJsonObject(request)
    if (!body.ok) return body.response

    const planned = planAdminAction(body.value)
    if (!planned.ok) {
      return rejected(planned.code, planned.reason)
    }

    const authorization = request.headers.get('authorization') ?? ''
    const accessToken = /^Bearer\s+(.+)$/i.exec(authorization.trim())?.[1]
    if (!accessToken) {
      return rejected(
        'unauthenticated',
        'Sign in to manage your household.',
        401,
      )
    }

    const caller = callerClient(accessToken)
    const user = await caller.currentUser()
    if (!user) {
      return rejected(
        'unauthenticated',
        'Sign in to manage your household.',
        401,
      )
    }

    const { plan } = planned

    if (plan.kind === 'rpc') {
      return jsonResponse(await caller.rpc(plan.name, plan.args))
    }

    if (plan.kind === 'household.delete') {
      const households = (await caller.select(
        'households?select=id,name&limit=2',
      )) as { id: string; name: string }[]

      // RLS limits this to the caller's own household.
      if (!Array.isArray(households) || households.length !== 1) {
        return rejected('not_a_member', 'You are not a member of a household.')
      }
      if (!confirmationMatches(plan.confirmHouseholdName, households[0].name)) {
        return rejected(
          'name_mismatch',
          'The typed household name does not match.',
          400,
          { expected: households[0].name },
        )
      }

      return jsonResponse(await caller.rpc('delete_household', {}))
    }

    // Account deletion. The database performs every in-database effect and
    // decides whether the account may go; only then is the auth row removed,
    // so a rejection leaves the account fully intact.
    const service = serviceClient()
    const prepared = (await service.rpc('admin_prepare_account_deletion', {
      target_user_id: user.id,
    })) as { status?: string } | null

    if (!prepared || prepared.status !== 'ok') {
      return jsonResponse(prepared as Json, 400)
    }

    await service.deleteAuthUser(user.id)
    return jsonResponse(prepared as Json)
  } catch (error) {
    if (error instanceof SupabaseRestError && error.status === 401) {
      return rejected(
        'unauthenticated',
        'Sign in to manage your household.',
        401,
      )
    }
    return unexpectedError('household-admin', error)
  }
})
