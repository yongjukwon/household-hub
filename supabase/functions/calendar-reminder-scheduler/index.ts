// Scheduled job: turns due Calendar reminders into notification rows.
//
// Runs frequently (every few minutes). The database supplies candidate events
// and the dispatch keys already recorded; `dueReminders` decides what is owed,
// and the unique dispatch key makes a retried or overlapping run a no-op.

import {
  guardMethod,
  isServiceRoleRequest,
  jsonResponse,
  rejected,
  unexpectedError,
} from '../_shared/http.ts'
import {
  candidateWindow,
  DEFAULT_GRACE_MINUTES,
  dueReminders,
  type ReminderCandidate,
} from '../_shared/reminders.ts'
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
    const { windowStart, windowEnd } = candidateWindow(
      now,
      DEFAULT_GRACE_MINUTES,
    )
    const service = serviceClient()

    const candidates = (await service.rpc('job_calendar_reminder_candidates', {
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
    })) as ReminderCandidate[]

    const due = dueReminders(candidates ?? [], { now })

    let recorded = 0
    let notifications = 0
    const failures: { eventId: string; preset: string; error: string }[] = []

    for (const reminder of due) {
      try {
        const result = (await service.rpc('job_record_calendar_reminder', {
          target_household_id: reminder.householdId,
          target_event_id: reminder.eventId,
          target_preset: reminder.preset,
          target_occurrence_start: reminder.occurrenceStart.toISOString(),
          target_fire_at: reminder.fireAt.toISOString(),
        })) as {
          status?: string
          details?: { recorded?: boolean; notifications?: number }
        }

        if (result?.details?.recorded) {
          recorded += 1
          notifications += result.details.notifications ?? 0
        }
      } catch (error) {
        // One bad event must not strand the rest of the run.
        failures.push({
          eventId: reminder.eventId,
          preset: reminder.preset,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (failures.length > 0) {
      console.error('calendar-reminder-scheduler partial failure', failures)
    }

    return jsonResponse({
      status: 'ok',
      details: {
        ranAt: now.toISOString(),
        candidates: candidates?.length ?? 0,
        due: due.length,
        recorded,
        notifications,
        failed: failures.length,
      },
    })
  } catch (error) {
    return unexpectedError('calendar-reminder-scheduler', error)
  }
})
