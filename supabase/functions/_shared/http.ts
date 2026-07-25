// Request plumbing shared by every Edge Function: CORS, method and body
// guards, and the two authentication modes (a signed-in caller for the admin
// function, the service role for the scheduled jobs).

export const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

export function rejected(
  code: string,
  reason: string,
  status = 400,
  details: Record<string, unknown> = {},
): Response {
  // Mirrors the database's HouseholdAdminResult shape so clients handle a
  // transport-level refusal exactly like a database-level one.
  return jsonResponse({ status: 'rejected', code, reason, details }, status)
}

/** Bearer token from the Authorization header, if the header is well formed. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

/** Constant-time comparison, so a wrong secret leaks no length or prefix. */
export function secretsMatch(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

/**
 * The scheduled jobs are invoked by the platform scheduler with the
 * service-role key, never by an application client.
 */
export function isServiceRoleRequest(
  request: Request,
  serviceRoleKey: string,
): boolean {
  const token = bearerToken(request)
  return token !== null && secretsMatch(token, serviceRoleKey)
}

export type ParsedBody =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; response: Response }

/** Parses a JSON object body, rejecting anything else. */
export async function parseJsonObject(request: Request): Promise<ParsedBody> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: rejected('invalid_body', 'Expected a JSON body.'),
    }
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      response: rejected('invalid_body', 'Expected a JSON object body.'),
    }
  }

  return { ok: true, value: raw as Record<string, unknown> }
}

/** Handles OPTIONS and rejects non-POST verbs; returns null when the request may proceed. */
export function guardMethod(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return rejected('method_not_allowed', 'Use POST.', 405)
  }
  return null
}

/** Logs the failure without echoing internals to the caller. */
export function unexpectedError(scope: string, error: unknown): Response {
  console.error(`${scope} failed`, error)
  return rejected('internal_error', 'The request could not be completed.', 500)
}
