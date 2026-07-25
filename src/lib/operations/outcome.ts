import type { EnqueueOutcome } from './queue'

/**
 * A queued or settled command is accepted by the client flow. A discarded
 * command is a final server verdict and must remain visible in the form.
 */
export function operationOutcomeError(outcome: EnqueueOutcome): string | null {
  return outcome.status === 'discarded'
    ? outcome.discarded.explanation
    : null
}
