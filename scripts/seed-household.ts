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
 * Idempotent: re-running with the same args reuses the existing auth users
 * (by email), the existing household (by name), and the existing
 * household_members rows (by household_id + user_id) instead of duplicating
 * anything.
 */

import { createClient } from '@supabase/supabase-js'

interface MemberArg {
  email: string
  password: string
  displayName: string
}

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

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    fail(
      'Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY environment variables.\n' +
        '  These must be set explicitly on the command line (this script does NOT read .env.local,\n' +
        '  and does NOT use the VITE_ prefixed vars — those are anon-scoped for the frontend).\n' +
        '  Example:\n' +
        '    SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`> \\\n' +
        '      npx tsx scripts/seed-household.ts --name "The Smiths" \\\n' +
        '      --member "alice@example.com:s3cret1:Alice" --member "bob@example.com:s3cret2:Bob"',
    )
  }

  const { name, members } = parseArgs(process.argv.slice(2))

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // --- Step 1: find-or-create each auth user ---
  const userIds: string[] = []
  for (const member of members) {
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email: member.email,
        password: member.password,
        email_confirm: true,
      })

    if (created?.user) {
      console.log(`Created auth user ${member.email} (${created.user.id})`)
      userIds.push(created.user.id)
      continue
    }

    const alreadyExists = /already.*registered|already.*exists/i.test(
      createError?.message ?? '',
    )
    if (!alreadyExists) {
      fail(
        `Failed to create user ${member.email}: ${createError?.message ?? 'unknown error'}`,
      )
    }

    // Reuse existing user: paginate listUsers looking for a matching email.
    let existingId: string | undefined
    for (let page = 1; !existingId; page++) {
      const { data: listed, error: listError } =
        await supabase.auth.admin.listUsers({
          page,
          perPage: 200,
        })
      if (listError) {
        fail(
          `Failed to look up existing user ${member.email}: ${listError.message}`,
        )
      }
      const match = listed.users.find(
        (u) => u.email?.toLowerCase() === member.email.toLowerCase(),
      )
      if (match) {
        existingId = match.id
        break
      }
      if (listed.users.length < 200) break // no more pages
    }

    if (!existingId) {
      fail(
        `User ${member.email} reportedly already exists but could not be found via listUsers.`,
      )
    }

    console.log(`Reusing existing auth user ${member.email} (${existingId})`)
    userIds.push(existingId)
  }

  // --- Step 2: find-or-create the household ---
  const { data: existingHousehold, error: findHouseholdError } = await supabase
    .from('households')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (findHouseholdError) {
    fail(`Failed to look up household "${name}": ${findHouseholdError.message}`)
  }

  let householdId: string
  if (existingHousehold) {
    householdId = existingHousehold.id
    console.log(`Reusing existing household "${name}" (${householdId})`)
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('households')
      .insert({ name })
      .select('id')
      .single()

    if (insertError || !inserted) {
      fail(
        `Failed to create household "${name}": ${insertError?.message ?? 'unknown error'}`,
      )
    }

    householdId = inserted.id
    console.log(`Created household "${name}" (${householdId})`)
  }

  // --- Step 3: find-or-create household_members rows ---
  const rows = members.map((member, i) => ({
    household_id: householdId,
    user_id: userIds[i],
    display_name: member.displayName,
  }))

  const { error: upsertError } = await supabase
    .from('household_members')
    .upsert(rows, { onConflict: 'household_id,user_id' })

  if (upsertError) {
    fail(`Failed to upsert household_members: ${upsertError.message}`)
  }

  console.log(
    `Household membership up to date for: ${members.map((m) => m.displayName).join(', ')}`,
  )
  console.log('\nSeed complete.')
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err))
})
