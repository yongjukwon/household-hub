// Scheduled job: expires read inbox notifications after the retention window.
// Unread items are kept indefinitely — they are the user's outstanding work.

import {
  guardMethod,
  isServiceRoleRequest,
  jsonResponse,
  parseJsonObject,
  rejected,
  unexpectedError,
} from '../_shared/http.ts'
import { READ_NOTIFICATION_TTL_DAYS } from '../_shared/retention.ts'
import { requiredEnv, serviceClient } from '../_shared/supabase.ts'

const DEFAULT_TTL_DAYS = READ_NOTIFICATION_TTL_DAYS

Deno.serve(async (request) => {
  const guard = guardMethod(request)
  if (guard) return guard

  try {
    if (
      !isServiceRoleRequest(request, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
    ) {
      return rejected('forbidden', 'This job runs with the service role.', 403)
    }

    // The scheduler posts an empty body; an explicit TTL is only for operators
    // running the job by hand.
    let ttlDays = DEFAULT_TTL_DAYS
    if ((request.headers.get('content-length') ?? '0') !== '0') {
      const body = await parseJsonObject(request)
      if (!body.ok) return body.response
      if (body.value.ttlDays !== undefined) {
        if (
          typeof body.value.ttlDays !== 'number' ||
          !Number.isInteger(body.value.ttlDays) ||
          body.value.ttlDays < 1
        ) {
          return rejected(
            'invalid_ttl',
            'The notification TTL must be a whole number of days, at least one.',
          )
        }
        ttlDays = body.value.ttlDays
      }
    }

    const service = serviceClient()
    const result = await service.rpc('job_cleanup_read_notifications', {
      ttl_days: ttlDays,
    })

    return jsonResponse(result)
  } catch (error) {
    return unexpectedError('notification-cleanup', error)
  }
})
