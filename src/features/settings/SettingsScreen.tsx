import { useState, type ReactNode } from 'react'
import { isHouseholdAdminResult } from '@household-hub/domain'
import { Screen } from '@/shell/Screen'
import { SegmentedControl } from '@/shell/ui/SegmentedControl'
import { ConfirmDialog } from '@/shell/ui/ConfirmDialog'
import { useAuth } from '@/hooks/useAuth'
import { useActiveHousehold } from '@/features/household'
import {
  applyAppearance,
  getStoredAppearance,
  type Appearance,
} from '@/lib/appearance'
import { saveProfileSettings, useProfile } from './profile'
import {
  createInvite,
  deleteHousehold,
  prepareAccountDeletion,
  removeMember,
  revokeInvite,
  transferOwnership,
  useHouseholdInvites,
  useHouseholdMembers,
} from './household'
import { DangerConfirm } from './DangerConfirm'

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]">
      <h2 className="mb-3 text-sm font-semibold text-[var(--hh-muted)]">{title}</h2>
      {children}
    </section>
  )
}

const field =
  'w-full rounded-[var(--hh-radius-control)] border border-[var(--hh-line)] bg-[var(--hh-surface)] px-3 py-2 text-[var(--hh-ink)] outline-none focus:border-[var(--hh-accent)]'

/** Settings: profile, appearance, household/invite/ownership, account, danger. */
export function SettingsScreen() {
  const { user, signOut } = useAuth()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const profile = useProfile()
  const members = useHouseholdMembers(householdId)
  const invites = useHouseholdInvites(householdId)

  const [appearance, setAppearance] = useState<Appearance>(getStoredAppearance)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null)
  const [transferTarget, setTransferTarget] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [deleteHouseholdOpen, setDeleteHouseholdOpen] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)

  const nameValue = displayName ?? profile.data?.displayName ?? ''
  const currentMember = members.data?.find((m) => m.userId === user?.id)
  const partner = members.data?.find((m) => m.userId !== user?.id)
  const isOwner = currentMember?.isOwner ?? false

  function chooseAppearance(next: Appearance) {
    setAppearance(next)
    applyAppearance(next)
    if (householdId && user && profile.data) {
      void saveProfileSettings(
        householdId,
        user.id,
        { appearance: next },
        profile.data.revision,
      )
    }
  }

  async function commitDisplayName() {
    if (!householdId || !user || !profile.data || displayName === null) return
    const trimmed = displayName.trim()
    if (trimmed.length === 0 || trimmed === profile.data.displayName) {
      setDisplayName(null)
      return
    }
    await saveProfileSettings(
      householdId,
      user.id,
      { displayName: trimmed },
      profile.data.revision,
    )
    setDisplayName(null)
  }

  async function toggleNotifications(next: boolean) {
    if (!householdId || !user || !profile.data) return
    await saveProfileSettings(
      householdId,
      user.id,
      { notificationsEnabled: next },
      profile.data.revision,
    )
    void profile.refetch()
  }

  function reportResult(value: unknown, okMessage: string) {
    if (isHouseholdAdminResult(value) && value.status === 'rejected') {
      setNotice(value.reason)
    } else {
      setNotice(okMessage)
    }
  }

  async function handleCreateInvite() {
    const result = await createInvite()
    if (result.status === 'ok') {
      const code = typeof result.details?.code === 'string' ? result.details.code : null
      setNewInviteCode(code)
      setNotice(code ? null : 'Invite created.')
      void invites.refetch()
    } else {
      setNotice(result.reason)
    }
  }

  return (
    <Screen title="Settings">
      <div className="space-y-4">
        {notice && (
          <p
            role="status"
            className="rounded-[var(--hh-radius-control)] bg-[var(--hh-accent-soft)] px-3 py-2 text-sm text-[var(--hh-ink)]"
          >
            {notice}
          </p>
        )}

        <Section title="Profile">
          <label className="mb-1 block text-sm text-[var(--hh-muted)]" htmlFor="display-name">
            Display name
          </label>
          <input
            id="display-name"
            className={field}
            value={nameValue}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => void commitDisplayName()}
          />
          <label className="mt-3 flex items-center justify-between">
            <span className="text-[var(--hh-ink)]">Notifications</span>
            <input
              type="checkbox"
              aria-label="Notifications"
              checked={profile.data?.notificationsEnabled ?? false}
              onChange={(e) => void toggleNotifications(e.target.checked)}
            />
          </label>
        </Section>

        <Section title="Appearance">
          <SegmentedControl
            label="Appearance"
            options={APPEARANCE_OPTIONS}
            value={appearance}
            onChange={chooseAppearance}
          />
        </Section>

        <Section title="Household">
          <p className="text-[var(--hh-ink)]">{household.data?.name ?? '—'}</p>
          <ul className="mt-2 space-y-1">
            {(members.data ?? []).map((m) => (
              <li key={m.userId} className="flex items-center justify-between text-sm">
                <span className="text-[var(--hh-ink)]">
                  {m.displayName}
                  {m.isOwner && (
                    <span className="ml-2 text-xs text-[var(--hh-muted)]">Owner</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {isOwner && partner && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setTransferTarget(partner.userId)}
                className="rounded-[var(--hh-radius-control)] bg-[var(--hh-surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--hh-ink)]"
              >
                Transfer ownership
              </button>
              <button
                type="button"
                onClick={() => setRemoveTarget(partner.userId)}
                className="rounded-[var(--hh-radius-control)] px-3 py-1.5 text-sm font-medium text-[var(--hh-danger)]"
              >
                Remove {partner.displayName}
              </button>
            </div>
          )}

          {!partner && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void handleCreateInvite()}
                className="rounded-[var(--hh-radius-control)] bg-[var(--hh-accent)] px-3 py-1.5 text-sm font-medium text-white"
              >
                Create invite
              </button>
              {newInviteCode && (
                <div className="mt-2 rounded-[var(--hh-radius-control)] bg-[var(--hh-surface-2)] p-3">
                  <p className="text-xs text-[var(--hh-muted)]">
                    Share this single-use code (expires in 7 days):
                  </p>
                  <p className="mt-1 font-mono text-sm break-all text-[var(--hh-ink)]">
                    {newInviteCode}
                  </p>
                </div>
              )}
              {(invites.data ?? []).length > 0 && (
                <ul className="mt-2 space-y-1">
                  {(invites.data ?? []).map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--hh-muted)]">
                        Pending · expires {inv.expiresAt.slice(0, 10)}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          reportResult(await revokeInvite(inv.id), 'Invite revoked.')
                          void invites.refetch()
                        }}
                        className="text-[var(--hh-danger)]"
                      >
                        Revoke
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Section>

        <Section title="Account">
          <p className="text-[var(--hh-ink)]">{user?.email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 font-medium text-[var(--hh-accent)]"
          >
            Sign out
          </button>
        </Section>

        <Section title="Danger zone">
          <div className="space-y-2">
            {isOwner && (
              <button
                type="button"
                onClick={() => setDeleteHouseholdOpen(true)}
                className="block w-full text-left font-medium text-[var(--hh-danger)]"
              >
                Delete household
              </button>
            )}
            <button
              type="button"
              onClick={() => setDeleteAccountOpen(true)}
              className="block w-full text-left font-medium text-[var(--hh-danger)]"
            >
              Delete account
            </button>
          </div>
        </Section>
      </div>

      <ConfirmDialog
        open={!!transferTarget}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(null)
        }}
        title="Transfer ownership?"
        description="The other member becomes the household owner. You remain a member."
        confirmLabel="Transfer"
        destructive={false}
        onConfirm={async () => {
          if (transferTarget) {
            reportResult(await transferOwnership(transferTarget), 'Ownership transferred.')
            void members.refetch()
          }
          setTransferTarget(null)
        }}
      />
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        title="Remove member?"
        description="They lose access to this household. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (removeTarget) {
            reportResult(await removeMember(removeTarget), 'Member removed.')
            void members.refetch()
          }
          setRemoveTarget(null)
        }}
      />
      <DangerConfirm
        open={deleteHouseholdOpen}
        onOpenChange={setDeleteHouseholdOpen}
        title="Delete household"
        description="This permanently deletes the household and all its data for both members."
        confirmPhrase={household.data?.name ?? 'DELETE'}
        confirmLabel="Delete household"
        onConfirm={async () => {
          reportResult(await deleteHousehold(), 'Household deleted.')
        }}
      />
      <DangerConfirm
        open={deleteAccountOpen}
        onOpenChange={setDeleteAccountOpen}
        title="Delete account"
        description="This schedules your account for deletion and signs you out."
        confirmPhrase="DELETE"
        confirmLabel="Delete account"
        onConfirm={async () => {
          if (user) {
            const result = await prepareAccountDeletion(user.id)
            if (result.status === 'ok') {
              await signOut()
            } else {
              setNotice(result.reason)
            }
          }
        }}
      />
    </Screen>
  )
}
