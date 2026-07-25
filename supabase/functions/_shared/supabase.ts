// Minimal Supabase REST access for the Edge Functions.
//
// The functions only ever call RPCs and two Auth admin endpoints, so plain
// fetch is enough. Avoiding the SDK keeps the functions dependency-free, which
// means `deno check` and `deno test` run offline and no third-party bundle
// executes with the service-role key.

export type { Json } from './json.ts'

import type { Json } from './json.ts'

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

export class SupabaseRestError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(`${endpoint} failed with ${status}: ${body}`)
    this.name = 'SupabaseRestError'
  }
}

export type SupabaseRest = {
  /** Calls a Postgres function through PostgREST. */
  rpc: (name: string, args?: Record<string, Json>) => Promise<Json>
  /** Reads rows through PostgREST, subject to whatever key is in use. */
  select: (path: string) => Promise<Json>
  /** The authenticated user behind the caller's access token, if any. */
  currentUser: () => Promise<{ id: string; email: string | null } | null>
  /** Service-role only: removes the `auth.users` row. */
  deleteAuthUser: (userId: string) => Promise<void>
}

export type SupabaseRestOptions = {
  url: string
  /** The anon or service-role key, used as `apikey`. */
  key: string
  /** A user access token to act as; defaults to acting as `key`. */
  accessToken?: string
}

export function createSupabaseRest({
  url,
  key,
  accessToken,
}: SupabaseRestOptions): SupabaseRest {
  const base = url.replace(/\/+$/, '')
  const headers = {
    apikey: key,
    authorization: `Bearer ${accessToken ?? key}`,
    'content-type': 'application/json',
  }

  const request = async (endpoint: string, init: RequestInit) => {
    const response = await fetch(`${base}${endpoint}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    })
    if (!response.ok) {
      throw new SupabaseRestError(
        endpoint,
        response.status,
        await response.text(),
      )
    }
    return response
  }

  return {
    async rpc(name, args = {}) {
      const response = await request(`/rest/v1/rpc/${name}`, {
        method: 'POST',
        body: JSON.stringify(args),
      })
      const text = await response.text()
      return text ? (JSON.parse(text) as Json) : null
    },

    async select(path) {
      const response = await request(`/rest/v1/${path.replace(/^\/+/, '')}`, {
        method: 'GET',
      })
      return (await response.json()) as Json
    },

    async currentUser() {
      const response = await fetch(`${base}/auth/v1/user`, { headers })
      if (!response.ok) return null
      const user = (await response.json()) as { id?: string; email?: string }
      return user?.id ? { id: user.id, email: user.email ?? null } : null
    },

    async deleteAuthUser(userId) {
      await request(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' })
    },
  }
}

/** A client acting with the service-role key, for the scheduled jobs. */
export function serviceClient(): SupabaseRest {
  return createSupabaseRest({
    url: requiredEnv('SUPABASE_URL'),
    key: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  })
}

/** A client acting as the caller, so RLS and `auth.uid()` still apply. */
export function callerClient(accessToken: string): SupabaseRest {
  return createSupabaseRest({
    url: requiredEnv('SUPABASE_URL'),
    key: requiredEnv('SUPABASE_ANON_KEY'),
    accessToken,
  })
}
