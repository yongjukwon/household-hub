import { describe, expect, it } from 'vitest'
import { isOperationCommand, isOperationResult } from './index'

const uuid = '550e8400-e29b-41d4-a716-446655440000'

function command(
  type: string,
  entityType: string,
  payload: Record<string, unknown>,
) {
  return {
    schemaVersion: 1,
    operationId: uuid,
    deviceId: '550e8400-e29b-41d4-a716-446655440001',
    localSequence: 0,
    householdId: '550e8400-e29b-41d4-a716-446655440002',
    type,
    entityType,
    entityId: '550e8400-e29b-41d4-a716-446655440003',
    baseRevision: null,
    enqueuedAt: '2026-07-24T12:30:00.000Z',
    payload,
  }
}

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
    for (const [type, entityType] of [
      ['ledger.year.upsert', 'ledger_year'],
      ['ledger.year.clear', 'ledger_year'],
      ['ledger.category.upsert', 'ledger_category'],
      ['ledger.limit.upsert', 'ledger_limit'],
      ['ledger.transfer.upsert', 'ledger_transfer'],
      ['ledger.schedule.upsert', 'ledger_schedule'],
    ]) {
      expect(
        isOperationCommand({
          schemaVersion: 1,
          operationId: uuid,
          deviceId: '550e8400-e29b-41d4-a716-446655440001',
          localSequence: 0,
          householdId: '550e8400-e29b-41d4-a716-446655440002',
          type,
          entityType,
          entityId: '550e8400-e29b-41d4-a716-446655440003',
          baseRevision: null,
          enqueuedAt: '2026-07-24T12:30:00.000Z',
          payload: {},
        }),
      ).toBe(true)
    }
  })

  it('allows durable notification removal operations', () => {
    for (const type of ['notification.delete', 'notification.clear']) {
      expect(isOperationCommand({
        schemaVersion: 1,
        operationId: uuid,
        deviceId: '550e8400-e29b-41d4-a716-446655440001',
        localSequence: 1,
        householdId: '550e8400-e29b-41d4-a716-446655440002',
        type,
        entityType: 'notification',
        entityId: '550e8400-e29b-41d4-a716-446655440003',
        baseRevision: null,
        enqueuedAt: '2026-07-24T12:30:00.000Z',
        payload: {},
      })).toBe(true)
    }
  })

  it('enforces the shared operation-to-entity mapping', () => {
    expect(isOperationCommand(command('grocery.item.upsert', 'grocery_item', {
      listId: '550e8400-e29b-41d4-a716-446655440004',
      name: 'Milk',
      quantity: '1',
      checked: false,
      unitPriceCents: null,
      sortOrder: 0,
    }))).toBe(true)
    expect(isOperationCommand(command('grocery.item.upsert', 'notification', {
      listId: '550e8400-e29b-41d4-a716-446655440004',
      name: 'Milk',
      quantity: '1',
      checked: false,
      unitPriceCents: null,
      sortOrder: 0,
    }))).toBe(false)
    expect(isOperationCommand(command('notification.clear', 'notification', {})))
      .toBe(true)
    expect(isOperationCommand(command('notification.clear', 'settings', {})))
      .toBe(false)
  })

  it('accepts legacy-only and canonical Grocery item payloads', () => {
    const legacy = {
      listId: '550e8400-e29b-41d4-a716-446655440004',
      name: 'Milk',
      quantity: '2',
      checked: false,
      unitPriceCents: 499,
      sortOrder: 0,
    }
    const canonical = {
      ...legacy,
      checked: true,
      unitPriceCents: 250,
      purchaseQuantity: 2,
      totalPriceCents: 500,
      purchaseOccurrenceId: '550e8400-e29b-41d4-a716-446655440005',
    }

    expect(isOperationCommand(command('grocery.item.upsert', 'grocery_item', legacy)))
      .toBe(true)
    expect(isOperationCommand(command('grocery.item.upsert', 'grocery_item', canonical)))
      .toBe(true)

    for (const producerState of [
      {
        ...canonical,
        checked: false,
        unitPriceCents: null,
        purchaseQuantity: null,
        totalPriceCents: null,
        purchaseOccurrenceId: null,
      },
      {
        ...canonical,
        checked: false,
        purchaseOccurrenceId: null,
      },
      {
        ...canonical,
        checked: false,
        unitPriceCents: null,
        totalPriceCents: null,
        purchaseOccurrenceId: null,
      },
      {
        ...canonical,
        checked: true,
        unitPriceCents: null,
        purchaseQuantity: null,
        totalPriceCents: null,
      },
    ]) {
      expect(isOperationCommand(command(
        'grocery.item.upsert',
        'grocery_item',
        producerState,
      ))).toBe(true)
    }
  })

  it('rejects partial, nonpositive, and inconsistent canonical Grocery payloads', () => {
    const canonical = {
      listId: '550e8400-e29b-41d4-a716-446655440004',
      name: 'Milk',
      quantity: '2',
      checked: true,
      unitPriceCents: 250,
      purchaseQuantity: 2,
      totalPriceCents: 500,
      purchaseOccurrenceId: '550e8400-e29b-41d4-a716-446655440005',
      sortOrder: 0,
    }

    expect(isOperationCommand(command('grocery.item.upsert', 'grocery_item', {
      ...canonical,
      purchaseQuantity: 0,
    }))).toBe(false)
    expect(isOperationCommand(command('grocery.item.upsert', 'grocery_item', {
      ...canonical,
      totalPriceCents: -1,
    }))).toBe(false)
    expect(isOperationCommand(command('grocery.item.upsert', 'grocery_item', {
      ...canonical,
      unitPriceCents: 0,
      purchaseQuantity: 3,
      totalPriceCents: 1,
    }))).toBe(false)
    expect(isOperationCommand(command('grocery.item.upsert', 'grocery_item', {
      ...canonical,
      purchaseOccurrenceId: null,
    }))).toBe(false)
    expect(isOperationCommand(command('grocery.item.upsert', 'grocery_item', {
      ...canonical,
      checked: false,
    }))).toBe(false)
    const partial = Object.fromEntries(
      Object.entries(canonical).filter(([key]) => key !== 'totalPriceCents'),
    )
    expect(isOperationCommand(command('grocery.item.upsert', 'grocery_item', partial)))
      .toBe(false)
  })

  it('validates settings and notification-removal payloads at the shared boundary', () => {
    expect(isOperationCommand(command('settings.update', 'settings', {
      appearance: 'dark',
      notificationsEnabled: false,
    }))).toBe(true)
    expect(isOperationCommand(command('settings.update', 'settings', {
      displayName: 'Yongju',
      appearance: 'system',
      notificationsEnabled: true,
      mobileNavigation: ['notes', 'trips', 'groceries'],
      suppressUnpricedPurchaseWarning: true,
    }))).toBe(true)
    expect(isOperationCommand(command('settings.update', 'settings', {})))
      .toBe(false)
    expect(isOperationCommand(command('settings.update', 'settings', {
      mobileNavigation: ['notes', 'notes', 'groceries'],
    }))).toBe(false)
    expect(isOperationCommand(command('settings.update', 'settings', {
      appearance: 'dark',
      actorUserId: uuid,
    }))).toBe(false)
    expect(isOperationCommand(command('notification.delete', 'notification', {
      recipientUserId: uuid,
    }))).toBe(false)
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

  it('accepts applied results with structured operation details', () => {
    expect(
      isOperationResult({
        status: 'applied',
        operationId: uuid,
        serverSequence: 10,
        entityRevision: 2,
        details: {
          detachedTripExpenseCount: 1,
          detachedTripExpenseIds: ['550e8400-e29b-41d4-a716-446655440004'],
        },
      }),
    ).toBe(true)
    expect(
      isOperationResult({
        status: 'applied',
        operationId: uuid,
        serverSequence: 10,
        details: [],
      }),
    ).toBe(false)
  })

  it('requires rejected results to explain the failure with structured details', () => {
    expect(
      isOperationResult({
        status: 'rejected',
        operationId: uuid,
        code: 'category_has_spending',
        reason: 'Category has spending in selected or later months',
        details: { blockingMonths: ['04'] },
        warnings: [],
      }),
    ).toBe(true)
    expect(
      isOperationResult({
        status: 'rejected',
        operationId: uuid,
        code: '',
        reason: '',
        details: [],
        warnings: {},
      }),
    ).toBe(false)
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
