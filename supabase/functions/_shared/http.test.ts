import { assertEquals } from 'jsr:@std/assert@1'

import {
  bearerToken,
  guardMethod,
  isServiceRoleRequest,
  parseJsonObject,
  secretsMatch,
} from './http.ts'

const post = (body: BodyInit | null = null, headers: HeadersInit = {}) =>
  new Request('https://functions.local/test', { method: 'POST', body, headers })

Deno.test('bearerToken reads a well-formed Authorization header', () => {
  assertEquals(bearerToken(post(null, { authorization: 'Bearer abc' })), 'abc')
  assertEquals(
    bearerToken(post(null, { authorization: 'bearer  abc ' })),
    'abc',
  )
  assertEquals(bearerToken(post(null, { authorization: 'Basic abc' })), null)
  assertEquals(bearerToken(post()), null)
})

Deno.test('secretsMatch compares full values', () => {
  assertEquals(secretsMatch('service-role-key', 'service-role-key'), true)
  assertEquals(secretsMatch('service-role-key', 'service-role-ke'), false)
  assertEquals(secretsMatch('service-role-key', 'Service-role-key'), false)
  assertEquals(secretsMatch('', ''), true)
})

Deno.test('only the service-role key authorizes a job request', () => {
  assertEquals(
    isServiceRoleRequest(
      post(null, { authorization: 'Bearer job-key' }),
      'job-key',
    ),
    true,
  )
  assertEquals(
    isServiceRoleRequest(
      post(null, { authorization: 'Bearer anon-key' }),
      'job-key',
    ),
    false,
  )
  assertEquals(isServiceRoleRequest(post(), 'job-key'), false)
})

Deno.test(
  'preflight requests are answered and other verbs refused',
  async () => {
    const preflight = guardMethod(
      new Request('https://functions.local/test', { method: 'OPTIONS' }),
    )
    assertEquals(preflight?.status, 204)
    assertEquals(preflight?.headers.get('access-control-allow-origin'), '*')

    const get = guardMethod(new Request('https://functions.local/test'))
    assertEquals(get?.status, 405)
    assertEquals(await get?.json(), {
      status: 'rejected',
      code: 'method_not_allowed',
      reason: 'Use POST.',
      details: {},
    })

    assertEquals(guardMethod(post('{}')), null)
  },
)

Deno.test('a JSON object body parses; anything else is rejected', async () => {
  const parsed = await parseJsonObject(post(JSON.stringify({ action: 'x' })))
  assertEquals(parsed.ok, true)
  if (parsed.ok) assertEquals(parsed.value, { action: 'x' })

  for (const body of ['not json', '[]', '"text"', '7']) {
    const failure = await parseJsonObject(post(body))
    assertEquals(failure.ok, false)
    if (!failure.ok) {
      assertEquals(failure.response.status, 400)
      assertEquals((await failure.response.json()).code, 'invalid_body')
    }
  }
})
