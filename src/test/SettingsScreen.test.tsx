import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { useAuth } from '@/hooks/useAuth'
import { useActiveHousehold } from '@/features/household'
import * as profileModule from '@/features/settings/profile'
import * as householdModule from '@/features/settings/household'

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('@/features/household', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/household')>()),
  useActiveHousehold: vi.fn(),
}))
vi.mock('@/features/settings/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/settings/profile')>()),
  useProfile: vi.fn(),
  saveProfileSettings: vi.fn().mockResolvedValue({ status: 'queued', operationId: 'o' }),
}))
vi.mock('@/features/settings/household', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/settings/household')>()),
  useHouseholdMembers: vi.fn(),
  useHouseholdInvites: vi.fn(),
  createInvite: vi.fn(),
}))

const HH = '11111111-1111-1111-1111-111111111111'
const ME = 'user-me'
const PARTNER = 'user-partner'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    user: { id: ME, email: 'me@example.com' },
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>)
  vi.mocked(useActiveHousehold).mockReturnValue({
    data: { id: HH, name: 'Nest', members: [] },
    isError: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useActiveHousehold>)
  vi.mocked(profileModule.useProfile).mockReturnValue({
    data: { userId: ME, displayName: 'Me', appearance: 'system', notificationsEnabled: true, revision: 3 },
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof profileModule.useProfile>)
  vi.mocked(householdModule.useHouseholdInvites).mockReturnValue({
    data: [],
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof householdModule.useHouseholdInvites>)
})

function setMembers(members: householdModule.HouseholdMemberDetail[]) {
  vi.mocked(householdModule.useHouseholdMembers).mockReturnValue({
    data: members,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof householdModule.useHouseholdMembers>)
}

describe('SettingsScreen', () => {
  it('persists a notifications toggle via settings.update', async () => {
    setMembers([{ userId: ME, displayName: 'Me', role: 'owner', isOwner: true }])
    render(<SettingsScreen />)
    await userEvent.click(screen.getByLabelText('Notifications'))
    expect(profileModule.saveProfileSettings).toHaveBeenCalledWith(
      HH,
      ME,
      { notificationsEnabled: false },
      3,
    )
  })

  it('saves a changed display name on blur', async () => {
    setMembers([{ userId: ME, displayName: 'Me', role: 'owner', isOwner: true }])
    render(<SettingsScreen />)
    const input = screen.getByLabelText('Display name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Rabbit')
    await userEvent.tab()
    expect(profileModule.saveProfileSettings).toHaveBeenCalledWith(
      HH,
      ME,
      { displayName: 'Rabbit' },
      3,
    )
  })

  it('offers ownership transfer and removal only to the owner with a partner', () => {
    setMembers([
      { userId: ME, displayName: 'Me', role: 'owner', isOwner: true },
      { userId: PARTNER, displayName: 'Pat', role: 'member', isOwner: false },
    ])
    render(<SettingsScreen />)
    expect(screen.getByRole('button', { name: 'Transfer ownership' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Remove Pat/ })).toBeInTheDocument()
    // Create-invite is only shown when there is no partner.
    expect(screen.queryByRole('button', { name: 'Create invite' })).not.toBeInTheDocument()
  })

  it('shows the invite code returned by createInvite', async () => {
    setMembers([{ userId: ME, displayName: 'Me', role: 'owner', isOwner: true }])
    vi.mocked(householdModule.createInvite).mockResolvedValue({
      status: 'ok',
      details: { code: 'ABCD1234ABCD1234' },
    })
    render(<SettingsScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Create invite' }))
    expect(await screen.findByText('ABCD1234ABCD1234')).toBeInTheDocument()
  })

  it('gates household deletion behind typing the household name', async () => {
    setMembers([{ userId: ME, displayName: 'Me', role: 'owner', isOwner: true }])
    render(<SettingsScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete household' }))
    const confirmBtn = await screen.findByRole('button', { name: 'Delete household' })
    // The confirm button inside the sheet is disabled until the name matches.
    expect(confirmBtn).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Confirmation phrase'), 'Nest')
    expect(confirmBtn).toBeEnabled()
  })
})
