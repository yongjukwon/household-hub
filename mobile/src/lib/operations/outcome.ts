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

/** Converts a thrown local/transport failure into text a form can safely show. */
export function operationThrownError(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error) || error.message.trim().length === 0) {
    return fallback
  }
  if (
    error.message.includes('baseRevision must be a revision') ||
    error.message.includes('revision must be a revision')
  ) {
    return 'This item is out of date. Refresh it and try again.'
  }
  return error.message
}
