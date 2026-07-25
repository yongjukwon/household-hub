/**
 * Public Expo env access. `EXPO_PUBLIC_*` values are inlined into the bundle at
 * build time, so they are anon-scoped only (never a service-role key or an
 * OAuth secret — see `.env.example`).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Warn rather than throw so tests and tooling can import modules that reach
  // through here without a configured environment.
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY',
  )
}

export const supabaseUrl = url ?? ''
export const supabaseAnonKey = anonKey ?? ''
