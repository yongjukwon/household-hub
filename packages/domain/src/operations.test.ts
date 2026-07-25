import { describe, expect, it } from 'vitest'
import { isOperationCommand, isOperationResult } from './index'

const uuid = '550e8400-e29b-41d4-a716-446655440000'

describe('operation contracts', () => {
  it('accepts an optimistic command only when its concurrency metadata is valid', () => {
    expect(
      isOperationCommand({
        schemaVersion: 1,
        operationId: uuid,
        deviceId: '550e8400-e29b-41d4-a716-446655440001',
        localSequence: 0,
        householdId: '550e8400-e29b-41d4-a716-446655440002',
        type: 'calendar.event.upsert',
        entityType: 'calendar_event',
        entityId: '550e8400-e29b-41d4-a716-446655440003',
        baseRevision: 3,
        enqueuedAt: '2026-07-24T12:30:00.000Z',
        payload: { title: 'Dinner' },
      }),
    ).toBe(true)
    expect(
      isOperationCommand({
        schemaVersion: 1,
        operationId: uuid,
        deviceId: uuid,
        localSequence: -1,
        householdId: uuid,
        type: 'unknown.write',
        entityType: 'thing',
        entityId: uuid,
        baseRevision: 0,
        enqueuedAt: 'not-a-date',
        payload: [],
      }),
    ).toBe(false)
  })

  it('allows every required Ledger write family', () => {
    for (const type of [
      'ledger.year.clear',
      'ledger.category.upsert',
      'ledger.limit.upsert',
      'ledger.transfer.upsert',
      'ledger.schedule.upsert',
    ]) {
      expect(
        isOperationCommand({
          schemaVersion: 1,
          operationId: uuid,
          deviceId: '550e8400-e29b-41d4-a716-446655440001',
          localSequence: 0,
          householdId: '550e8400-e29b-41d4-a716-446655440002',
          type,
          entityType: 'ledger_entity',
          entityId: '550e8400-e29b-41d4-a716-446655440003',
          baseRevision: null,
          enqueuedAt: '2026-07-24T12:30:00.000Z',
          payload: {},
        }),
      ).toBe(true)
    }
  })

  it('accepts applied results with a negative Asset-balance warning', () => {
    expect(
      isOperationResult({
        status: 'applied',
        operationId: uuid,
        serverSequence: 9,
        entityRevision: 4,
        warning: {
          code: 'negative_asset_balance',
          assetId: '550e8400-e29b-41d4-a716-446655440004',
          balanceCents: -250,
        },
      }),
    ).toBe(true)
  })

  it('requires detailed conflict results with the winning action and affected revision', () => {
    expect(
      isOperationResult({
        status: 'conflict',
        operationId: uuid,
        reason: 'Updated on another device',
      }),
    ).toBe(false)
    expect(
      isOperationResult({
        status: 'conflict',
        operationId: uuid,
        reason: '',
      }),
    ).toBe(false)
    expect(
      isOperationResult({
        status: 'conflict',
        operationId: uuid,
        reason: 'Updated on another device',
        currentRevision: 4,
        winner: {
          operationId: '550e8400-e29b-41d4-a716-446655440004',
          type: 'ledger.transaction.upsert',
          entityType: 'ledger_transaction',
          entityId: '550e8400-e29b-41d4-a716-446655440005',
          appliedAt: '2026-07-24T12:31:00.000Z',
        },
      }),
    ).toBe(true)
  })
})
