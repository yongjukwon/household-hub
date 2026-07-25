import { describe, expect, it } from 'vitest'
import {
  isRevision,
  isUuid,
  type Revision,
  type UUID,
} from '@household-hub/domain'

import { operationOutcomeError } from '@/lib/operations/outcome'
import type { EnqueueOutcome } from '@/lib/operations'

function uuid(value: string): UUID {
  if (!isUuid(value)) throw new Error(`not a UUID: ${value}`)
  return value
}

function revision(value: number): Revision {
  if (!isRevision(value)) throw new Error(`not a revision: ${value}`)
  return value
}

const OPERATION_ID = uuid('11111111-1111-4111-8111-111111111111')

describe('operationOutcomeError', () => {
  it('returns no error when an operation is queued', () => {
    const outcome: EnqueueOutcome = {
      status: 'queued',
      operationId: OPERATION_ID,
    }

    expect(operationOutcomeError(outcome)).toBeNull()
  })

  it('returns no error when an operation settles', () => {
    const outcome: EnqueueOutcome = {
      status: 'settled',
      operationId: OPERATION_ID,
      result: {
        status: 'applied',
        operationId: OPERATION_ID,
        serverSequence: 1,
        entityRevision: revision(1),
      },
    }

    expect(operationOutcomeError(outcome)).toBeNull()
  })

  it('returns the server explanation when an operation is discarded', () => {
    const outcome: EnqueueOutcome = {
      status: 'discarded',
      operationId: OPERATION_ID,
      discarded: {
        operationId: OPERATION_ID,
        reason: 'rejected',
        command: {
          schemaVersion: 1,
          operationId: OPERATION_ID,
          deviceId: uuid('22222222-2222-4222-8222-222222222222'),
          localSequence: 1,
          householdId: uuid('33333333-3333-4333-8333-333333333333'),
          type: 'calendar.event.upsert',
          entityType: 'calendar_event',
          entityId: uuid('44444444-4444-4444-8444-444444444444'),
          baseRevision: null,
          enqueuedAt: '2026-07-25T12:00:00.000Z',
          payload: {},
        },
        discardedAt: '2026-07-25T12:00:01.000Z',
        winner: null,
        code: 'invalid_payload',
        explanation: 'Operation payload is invalid for its type',
        details: {},
        warnings: [],
        acknowledgedAt: null,
      },
    }

    expect(operationOutcomeError(outcome)).toBe(
      'Operation payload is invalid for its type',
    )
  })
})
