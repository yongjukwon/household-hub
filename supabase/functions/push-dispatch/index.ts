// Scheduled job: delivers pending inbox notifications to Expo push tokens.
//
// The inbox row is the durable record; a push is a best-effort copy of it. Each
// (notification, device) pair is recorded so a retry never double-sends, and a
// token Expo reports as dead is disabled instead of retried forever.

import {
  buildMessages,
  chunk,
  EXPO_PUSH_ENDPOINT,
  interpretTickets,
  type PendingNotification,
} from '../_shared/expo.ts'
import {
  guardMethod,
  isServiceRoleRequest,
  jsonResponse,
  rejected,
  unexpectedError,
} from '../_shared/http.ts'
import { requiredEnv, serviceClient } from '../_shared/supabase.ts'

const MAX_NOTIFICATIONS_PER_RUN = 100

Deno.serve(async (request) => {
  const guard = guardMethod(request)
  if (guard) return guard

  try {
    if (
      !isServiceRoleRequest(request, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
    ) {
      return rejected('forbidden', 'This job runs with the service role.', 403)
    }

    const service = serviceClient()
    const pending = (await service.rpc('job_pending_push_notifications', {
      max_notifications: MAX_NOTIFICATIONS_PER_RUN,
    })) as PendingNotification[]

    const messages = buildMessages(pending ?? [])
    if (messages.length === 0) {
      return jsonResponse({
        status: 'ok',
        details: {
          pending: pending?.length ?? 0,
          sent: 0,
          failed: 0,
          disabled: 0,
          deferred: 0,
        },
      })
    }

    // Expo accepts an access token for projects with push security enabled.
    const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN')
    let sent = 0
    let failed = 0
    let disabled = 0
    let deferred = 0

    for (const batch of chunk(messages)) {
      let tickets: unknown = null
      let reachedExpo = false
      try {
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            ...(expoToken ? { authorization: `Bearer ${expoToken}` } : {}),
          },
          body: JSON.stringify(batch.map((addressed) => addressed.message)),
        })
        if (response.ok) {
          tickets = ((await response.json()) as { data?: unknown }).data ?? null
          reachedExpo = true
        } else {
          console.error(
            'Expo push rejected the batch',
            response.status,
            await response.text(),
          )
        }
      } catch (error) {
        console.error('Expo push request failed', error)
      }

      if (!reachedExpo) {
        // Nothing was attempted per-device. Recording a delivery row here would
        // permanently exclude the pair from the pending query, so the batch is
        // left untouched for the next run instead.
        deferred += batch.length
        continue
      }

      for (const outcome of interpretTickets(batch, tickets)) {
        if (outcome.status === 'sent') sent += 1
        else failed += 1

        await service.rpc('job_record_push_delivery', {
          target_notification_id: outcome.notificationId,
          target_device_row_id: outcome.deviceRowId,
          delivery_status: outcome.status,
          receipt_id: outcome.receiptId,
          failure_code: outcome.errorCode,
        })

        if (outcome.deviceNotRegistered) {
          await service.rpc('job_disable_notification_device', {
            target_device_row_id: outcome.deviceRowId,
            failure_code: outcome.errorCode,
          })
          disabled += 1
        }
      }
    }

    return jsonResponse({
      status: 'ok',
      details: {
        pending: pending?.length ?? 0,
        sent,
        failed,
        disabled,
        deferred,
      },
    })
  } catch (error) {
    return unexpectedError('push-dispatch', error)
  }
})
