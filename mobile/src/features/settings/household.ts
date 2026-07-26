import { useQuery } from '@tanstack/react-query'
import { isHouseholdAdminResult, type HouseholdAdminResult } from '@household-hub/domain'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export interface HouseholdMemberDetail {
  userId: string
  displayName: string
  role: string
  isOwner: boolean
}

/** Members with their roles, for ownership/removal actions in Settings. */
export function useHouseholdMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId ? ['household', householdId, 'members', 'roles'] : ['members', 'off'],
    enabled: !!householdId,
    queryFn: async (): Promise<HouseholdMemberDetail[]> => {
      const [members, household] = await Promise.all([
        supabase
          .from('household_members')
          .select('user_id, display_name, member_role')
          .order('created_at', { ascending: true })
          .returns<
            Pick<Tables<'household_members'>, 'user_id' | 'display_name' | 'member_role'>[]
          >(),
        supabase
          .from('households')
          .select('owner_user_id')
          .eq('id', householdId!)
          .maybeSingle()
          .returns<Pick<Tables<'households'>, 'owner_user_id'> | null>(),
      ])
      if (members.error) throw members.error
      if (household.error) throw household.error
      const ownerId = household.data?.owner_user_id ?? null
      return (members.data ?? []).map((m) => ({
        userId: m.user_id,
        displayName: m.display_name,
        role: m.member_role,
        isOwner: m.user_id === ownerId,
      }))
    },
  })
}

export interface PendingInvite {
  id: string
  expiresAt: string
}

/** Pending (unredeemed, unrevoked, unexpired) invites for the household. */
export function useHouseholdInvites(householdId: string | undefined) {
  return useQuery({
    queryKey: householdId ? ['household', householdId, 'invites'] : ['invites', 'off'],
    enabled: !!householdId,
    queryFn: async (): Promise<PendingInvite[]> => {
      const { data, error } = await supabase
        .from('household_invites')
        .select('id, expires_at, redeemed_at, revoked_at')
        .is('redeemed_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .returns<
          Pick<Tables<'household_invites'>, 'id' | 'expires_at' | 'redeemed_at' | 'revoked_at'>[]
        >()
      if (error) throw error
      const now = Date.now()
      return (data ?? [])
        .filter((r) => Date.parse(r.expires_at) > now)
        .map((r) => ({ id: r.id, expiresAt: r.expires_at }))
    },
  })
}

/** Normalizes an admin RPC's Json response into a typed result. */
function asAdminResult(value: unknown): HouseholdAdminResult {
  if (isHouseholdAdminResult(value)) return value
  return {
    status: 'rejected',
    code: 'unexpected_response',
    reason: 'The server returned an unexpected response.',
    details: {},
  }
}

async function callAdmin(
  fn:
    | 'create_household_invite'
    | 'delete_household',
): Promise<HouseholdAdminResult> {
  const { data, error } = await supabase.rpc(fn)
  if (error) {
    return { status: 'rejected', code: 'rpc_error', reason: error.message, details: {} }
  }
  return asAdminResult(data)
}

/** Create a single-use, 7-day invite. The plaintext code is returned once. */
export async function createInvite(): Promise<HouseholdAdminResult> {
  return callAdmin('create_household_invite')
}

/** Revoke a pending invite by id. */
export async function revokeInvite(inviteId: string): Promise<HouseholdAdminResult> {
  const { data, error } = await supabase.rpc('revoke_household_invite', {
    invite_id: inviteId,
  })
  if (error) return { status: 'rejected', code: 'rpc_error', reason: error.message, details: {} }
  return asAdminResult(data)
}

/** Transfer ownership to the partner (their user id). */
export async function transferOwnership(targetUserId: string): Promise<HouseholdAdminResult> {
  const { data, error } = await supabase.rpc('transfer_household_ownership', {
    target_user_id: targetUserId,
  })
  if (error) return { status: 'rejected', code: 'rpc_error', reason: error.message, details: {} }
  return asAdminResult(data)
}

/** Remove the partner from the household (their user id). */
export async function removeMember(targetUserId: string): Promise<HouseholdAdminResult> {
  const { data, error } = await supabase.rpc('remove_household_member', {
    target_user_id: targetUserId,
  })
  if (error) return { status: 'rejected', code: 'rpc_error', reason: error.message, details: {} }
  return asAdminResult(data)
}

/** Delete the entire household (owner only). */
export async function deleteHousehold(): Promise<HouseholdAdminResult> {
  return callAdmin('delete_household')
}

/** Prepare the signed-in user's account for deletion. */
export async function prepareAccountDeletion(userId: string): Promise<HouseholdAdminResult> {
  const { data, error } = await supabase.rpc('admin_prepare_account_deletion', {
    target_user_id: userId,
  })
  if (error) return { status: 'rejected', code: 'rpc_error', reason: error.message, details: {} }
  return asAdminResult(data)
}
