import { isHouseholdAdminResult } from '@household-hub/domain'
import { Stack } from 'expo-router'
import { useState, type ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DangerConfirm } from '@/components/DangerConfirm'
import { GradientBackground } from '@/components/GradientBackground'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useActiveHousehold } from '@/features/household'
import {
  createInvite,
  deleteHousehold,
  prepareAccountDeletion,
  removeMember,
  revokeInvite,
  transferOwnership,
  useHouseholdInvites,
  useHouseholdMembers,
} from '@/features/settings/household'
import { saveProfileSettings, useProfile } from '@/features/settings/profile'
import { useAuth } from '@/lib/auth/AuthContext'
import type { Appearance } from '@/lib/appearance'
import { syncPushRegistration } from '@/lib/notificationLifecycle'
import { supabase } from '@/lib/supabase'
import { useAppearance } from '@/theme/AppearanceProvider'
import { useTheme } from '@/theme/tokens'

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { tokens } = useTheme()
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: tokens.card, borderRadius: tokens.radiusCard },
        tokens.shadowCard,
      ]}
    >
      <Text style={[styles.sectionTitle, { color: tokens.muted }]}>{title}</Text>
      {children}
    </View>
  )
}

/** Settings: profile, appearance, household/invite/ownership, account, danger. */
export default function SettingsScreen() {
  const { tokens } = useTheme()
  const { session } = useAuth()
  const user = session?.user ?? null
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const profile = useProfile()
  const members = useHouseholdMembers(householdId)
  const invites = useHouseholdInvites(householdId)
  const { appearance, setAppearance } = useAppearance()

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
    if (householdId && user && profile.data) {
      void saveProfileSettings(householdId, user.id, { appearance: next }, profile.data.revision)
    }
  }

  async function commitDisplayName() {
    if (!householdId || !user || !profile.data || displayName === null) return
    const trimmed = displayName.trim()
    if (trimmed.length === 0 || trimmed === profile.data.displayName) {
      setDisplayName(null)
      return
    }
    await saveProfileSettings(householdId, user.id, { displayName: trimmed }, profile.data.revision)
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

  async function signOut() {
    await syncPushRegistration(false)
    await supabase.auth.signOut()
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
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['bottom']}>
      <GradientBackground />
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {notice ? (
          <View style={[styles.notice, { backgroundColor: tokens.accentSoft, borderRadius: tokens.radiusControl }]}>
            <Text style={[styles.noticeText, { color: tokens.ink }]}>{notice}</Text>
          </View>
        ) : null}

        <Section title="Profile">
          <Text style={[styles.fieldLabel, { color: tokens.muted }]}>Display name</Text>
          <TextInput
            accessibilityLabel="Display name"
            value={nameValue}
            onChangeText={setDisplayName}
            onBlur={() => void commitDisplayName()}
            style={[
              styles.input,
              { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
            ]}
          />
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: tokens.ink }]}>Notifications</Text>
            <Switch
              value={profile.data?.notificationsEnabled ?? false}
              onValueChange={(next) => void toggleNotifications(next)}
              trackColor={{ true: tokens.accent }}
            />
          </View>
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
          <Text style={[styles.householdName, { color: tokens.ink }]}>
            {household.data?.name ?? '—'}
          </Text>
          {(members.data ?? []).map((m) => (
            <View key={m.userId} style={styles.memberRow}>
              <Text style={[styles.memberName, { color: tokens.ink }]}>{m.displayName}</Text>
              {m.isOwner ? (
                <Text style={[styles.memberBadge, { color: tokens.muted }]}>Owner</Text>
              ) : null}
            </View>
          ))}

          {isOwner && partner ? (
            <View style={styles.householdActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setTransferTarget(partner.userId)}
                style={[styles.chipButton, { backgroundColor: tokens.cardAlt }]}
              >
                <Text style={[styles.chipButtonText, { color: tokens.ink }]}>Transfer ownership</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setRemoveTarget(partner.userId)}>
                <Text style={[styles.dangerLink, { color: tokens.danger }]}>
                  Remove {partner.displayName}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!partner ? (
            <View style={styles.inviteBlock}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleCreateInvite()}
                style={[styles.chipButton, { backgroundColor: tokens.accent }]}
              >
                <Text style={[styles.chipButtonText, { color: tokens.accentContrast }]}>
                  Create invite
                </Text>
              </Pressable>
              {newInviteCode ? (
                <View style={[styles.inviteCodeBox, { backgroundColor: tokens.cardAlt, borderRadius: tokens.radiusControl }]}>
                  <Text style={[styles.inviteHint, { color: tokens.muted }]}>
                    Share this single-use code (expires in 7 days):
                  </Text>
                  <Text style={[styles.inviteCode, { color: tokens.ink }]} selectable>
                    {newInviteCode}
                  </Text>
                </View>
              ) : null}
              {(invites.data ?? []).map((inv) => (
                <View key={inv.id} style={styles.inviteRow}>
                  <Text style={[styles.inviteMeta, { color: tokens.muted }]}>
                    Pending · expires {inv.expiresAt.slice(0, 10)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={async () => {
                      reportResult(await revokeInvite(inv.id), 'Invite revoked.')
                      void invites.refetch()
                    }}
                  >
                    <Text style={[styles.dangerLink, { color: tokens.danger }]}>Revoke</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </Section>

        <Section title="Account">
          <Text style={[styles.householdName, { color: tokens.ink }]}>{user?.email}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={() => void signOut()}
            style={styles.signOutRow}
          >
            <Text style={[styles.signOutText, { color: tokens.accent }]}>Sign out</Text>
          </Pressable>
        </Section>

        <Section title="Danger zone">
          {isOwner ? (
            <Pressable accessibilityRole="button" onPress={() => setDeleteHouseholdOpen(true)}>
              <Text style={[styles.dangerRow, { color: tokens.danger }]}>Delete household</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => setDeleteAccountOpen(true)}>
            <Text style={[styles.dangerRow, { color: tokens.danger }]}>Delete account</Text>
          </Pressable>
        </Section>
      </ScrollView>

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
              await syncPushRegistration(false)
              await supabase.auth.signOut()
            } else {
              setNotice(result.reason)
            }
          }
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  notice: { paddingHorizontal: 14, paddingVertical: 10 },
  noticeText: { fontSize: 13.5 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 12.5, fontWeight: '700', marginBottom: 12 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  switchLabel: { fontSize: 15, fontWeight: '500' },
  householdName: { fontSize: 15, fontWeight: '600' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  memberName: { fontSize: 14 },
  memberBadge: { fontSize: 11.5 },
  householdActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  chipButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  chipButtonText: { fontSize: 13, fontWeight: '600' },
  dangerLink: { fontSize: 13, fontWeight: '600' },
  inviteBlock: { marginTop: 14, gap: 10 },
  inviteCodeBox: { padding: 12 },
  inviteHint: { fontSize: 11.5 },
  inviteCode: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteMeta: { fontSize: 12.5 },
  signOutRow: { marginTop: 14 },
  signOutText: { fontSize: 15, fontWeight: '600' },
  dangerRow: { fontSize: 15, fontWeight: '600', marginTop: 8 },
})
