/**
 * One-off seed script: provisions a household and its two members.
 *
 * There is no signup UI (invite-only app) — this script is the only way
 * accounts get created. Run it manually against whichever Supabase stack
 * you're targeting (local or hosted); it never reads .env.local.
 *
 * Usage:
 *   SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-household.ts \
 *     --name "The Smiths" \
 *     --member "alice@example.com:s3cret1:Alice" \
 *     --member "bob@example.com:s3cret2:Bob"
 *
 * Only the auth users are created with the service-role key. The household
 * itself is provisioned through the real onboarding path — `onboard_household`
 * as the first member, then an invite the second member redeems — so the seeded
 * rows are exactly what the application produces (owner role, profiles, invite
 * redemption state) rather than a hand-built approximation. Direct writes to
 * `households`/`household_members` are revoked for clients anyway.
 *
 * Idempotent: re-running with the same args reuses the existing auth users (by
 * email) and skips onboarding/redemption for members that already belong to a
 * household.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

interface MemberArg {
  email: string
  password: string
  displayName: string
}

type AdminResult =
  | { status: 'ok'; details?: Record<string, unknown> }
  | { status: 'rejected'; code: string; reason: string }

function fail(message: string): never {
  console.error(`\nError: ${message}\n`)
  process.exit(1)
}

function parseArgs(argv: string[]): { name: string; members: MemberArg[] } {
  let name: string | undefined
  const members: MemberArg[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--name') {
      name = argv[++i]
    } else if (arg === '--member') {
      const raw = argv[++i]
      if (!raw)
        fail('--member requires a value of the form email:password:displayName')
      const match = /^([^:]+):([^:]+):(.+)$/.exec(raw)
      if (!match) {
        fail(
          `--member value "${raw}" is not in the form email:password:displayName`,
        )
      }
      const [, email, password, displayName] = match
      members.push({ email, password, displayName })
    } else {
      fail(`Unrecognized argument "${arg}"`)
    }
  }

  if (!name) fail('Missing required --name "<household name>" argument')
  if (members.length !== 2) {
    fail(
      `Expected exactly 2 --member arguments, got ${members.length}. ` +
        'Usage: --member email:password:displayName --member email:password:displayName',
    )
  }

  return { name, members }
}

/** Creates the auth user, or finds the existing one with that email. */
async function findOrCreateUser(
  admin: SupabaseClient,
  member: MemberArg,
): Promise<string> {
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: member.email,
      password: member.password,
      email_confirm: true,
    })

  if (created?.user) {
    console.log(`Created auth user ${member.email} (${created.user.id})`)
    return created.user.id
  }

  const alreadyExists = /already.*registered|already.*exists/i.test(
    createError?.message ?? '',
  )
  if (!alreadyExists) {
    fail(
      `Failed to create user ${member.email}: ${createError?.message ?? 'unknown error'}`,
    )
  }

  for (let page = 1; ; page++) {
    const { data: listed, error: listError } = await admin.auth.admin.listUsers(
      {
        page,
        perPage: 200,
      },
    )
    if (listError) {
      fail(
        `Failed to look up existing user ${member.email}: ${listError.message}`,
      )
    }
    const match = listed.users.find(
      (user) => user.email?.toLowerCase() === member.email.toLowerCase(),
    )
    if (match) {
      console.log(`Reusing existing auth user ${member.email} (${match.id})`)
      return match.id
    }
    if (listed.users.length < 200) break
  }

  fail(
    `User ${member.email} reportedly already exists but could not be found via listUsers.`,
  )
}

/** A client authenticated as `member`, so `auth.uid()` is that user. */
async function signIn(
  url: string,
  anonKey: string,
  member: MemberArg,
): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: member.email,
    password: member.password,
  })
  if (error) {
    fail(
      `Failed to sign in as ${member.email}: ${error.message}. ` +
        'If the account predates this run, its password may differ from the one passed here.',
    )
  }
  return client
}

async function callAdminRpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<AdminResult> {
  const { data, error } = await client.rpc(name, args)
  if (error) fail(`${name} failed: ${error.message}`)
  return data as AdminResult
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    fail(
      'Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY environment variables.\n' +
        '  These must be set explicitly on the command line (this script does NOT read .env.local,\n' +
        '  and does NOT use the VITE_ prefixed vars — those are anon-scoped for the frontend).\n' +
        '  SUPABASE_ANON_KEY is optional; without it the script signs in with the anon-equivalent\n' +
        '  service-role key instead.\n' +
        '  Example:\n' +
        '    SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`> \\\n' +
        '      npx tsx scripts/seed-household.ts --name "The Smiths" \\\n' +
        '      --member "alice@example.com:s3cret1:Alice" --member "bob@example.com:s3cret2:Bob"',
    )
  }

  const { name, members } = parseArgs(process.argv.slice(2))
  const [owner, partner] = members

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const userIds: string[] = []
  for (const member of members) {
    userIds.push(await findOrCreateUser(admin, member))
  }
  const partnerUserId = userIds[1]

  // --- The owner creates the household ---
  const ownerClient = await signIn(
    supabaseUrl,
    anonKey ?? serviceRoleKey,
    owner,
  )
  const onboarded = await callAdminRpc(ownerClient, 'onboard_household', {
    display_name: owner.displayName,
    household_name: name,
  })

  if (onboarded.status === 'ok') {
    console.log(
      `Created household "${name}" (${onboarded.details?.householdId}) owned by ${owner.displayName}`,
    )
  } else if (onboarded.code === 'already_member') {
    console.log(
      `${owner.displayName} already belongs to a household — skipping onboarding`,
    )
  } else {
    fail(`onboard_household rejected: ${onboarded.code} — ${onboarded.reason}`)
  }

  // --- The partner joins through an invite ---
  const partnerClient = await signIn(
    supabaseUrl,
    anonKey ?? serviceRoleKey,
    partner,
  )
  // Scoped to the partner's own row: a member can read both rows of their
  // household, so an unfiltered query returns two.
  const { data: existingMembership, error: membershipError } =
    await partnerClient
      .from('household_members')
      .select('id')
      .eq('user_id', partnerUserId)
      .maybeSingle()
  if (membershipError) {
    fail(
      `Failed to check ${partner.displayName}'s membership: ${membershipError.message}`,
    )
  }

  if (existingMembership) {
    console.log(
      `${partner.displayName} already belongs to a household — skipping invite`,
    )
  } else {
    const invite = await callAdminRpc(
      ownerClient,
      'create_household_invite',
      {},
    )
    if (invite.status !== 'ok') {
      fail(
        `create_household_invite rejected: ${invite.code} — ${invite.reason}`,
      )
    }

    const redeemed = await callAdminRpc(
      partnerClient,
      'redeem_household_invite',
      {
        code: invite.details?.code as string,
        display_name: partner.displayName,
      },
    )
    if (redeemed.status !== 'ok') {
      fail(
        `redeem_household_invite rejected: ${redeemed.code} — ${redeemed.reason}`,
      )
    }
    console.log(`${partner.displayName} joined "${name}" via invite`)
  }

  console.log('\nSeed complete.')
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err))
})
