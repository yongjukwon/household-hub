// Scheduled job: materializes due recurring Asset transfers.
//
// Occurrence dates are derived from the schedule's own timezone so a transfer
// keeps its wall-clock time across daylight saving. The database enforces
// idempotency on (schedule, occurrence date), so replaying a run cannot move
// money twice.

import {
  guardMethod,
  isServiceRoleRequest,
  jsonResponse,
  rejected,
  unexpectedError,
} from '../_shared/http.ts'
import { dueOccurrences, type TransferSchedule } from '../_shared/schedules.ts'
import { requiredEnv, serviceClient } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  const guard = guardMethod(request)
  if (guard) return guard

  try {
    if (
      !isServiceRoleRequest(request, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
    ) {
      return rejected('forbidden', 'This job runs with the service role.', 403)
    }

    const now = new Date()
    const service = serviceClient()
    const schedules = (await service.rpc('job_active_transfer_schedules')) as
      TransferSchedule[] | null

    let executed = 0
    let skipped = 0
    const warnings: unknown[] = []
    const failures: {
      scheduleId: string
      occurrenceDate?: string
      error: string
    }[] = []

    for (const schedule of schedules ?? []) {
      let occurrences: ReturnType<typeof dueOccurrences>
      try {
        occurrences = dueOccurrences(schedule, now)
      } catch (error) {
        failures.push({
          scheduleId: schedule.scheduleId,
          error: error instanceof Error ? error.message : String(error),
        })
        continue
      }

      for (const occurrence of occurrences) {
        try {
          const result = (await service.rpc('job_execute_transfer_occurrence', {
            target_schedule_id: schedule.scheduleId,
            target_occurrence_date: occurrence.occurrenceDate,
            target_occurred_at: occurrence.occurredAt.toISOString(),
          })) as {
            status?: string
            details?: { executed?: boolean; warnings?: unknown[] }
          }

          if (result?.status !== 'ok') {
            // A rejection is a standing condition (deleted asset, currency
            // mismatch); later occurrences of the same schedule would fail the
            // same way, so the schedule is left for the next run.
            failures.push({
              scheduleId: schedule.scheduleId,
              occurrenceDate: occurrence.occurrenceDate,
              error: JSON.stringify(result),
            })
            break
          }

          if (result.details?.executed === false) skipped += 1
          else executed += 1

          for (const warning of result.details?.warnings ?? []) {
            warnings.push({ scheduleId: schedule.scheduleId, warning })
          }
        } catch (error) {
          failures.push({
            scheduleId: schedule.scheduleId,
            occurrenceDate: occurrence.occurrenceDate,
            error: error instanceof Error ? error.message : String(error),
          })
          break
        }
      }
    }

    if (failures.length > 0) {
      console.error('recurring-transfer-executor partial failure', failures)
    }
    if (warnings.length > 0) {
      // Negative balances are allowed; they are reported, not blocked.
      console.warn('recurring-transfer-executor warnings', warnings)
    }

    return jsonResponse({
      status: 'ok',
      details: {
        ranAt: now.toISOString(),
        schedules: schedules?.length ?? 0,
        executed,
        skipped,
        warnings: warnings.length,
        failed: failures.length,
      },
    })
  } catch (error) {
    return unexpectedError('recurring-transfer-executor', error)
  }
})
