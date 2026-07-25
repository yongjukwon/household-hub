import { describe, expect, it } from 'vitest'
import { queryKeys } from './index'

const householdId = '550e8400-e29b-41d4-a716-446655440000'

describe('queryKeys', () => {
  it('scopes ledger month queries to the household and calendar month', () => {
    expect(queryKeys.ledger.month(householdId, 2026, 7)).toEqual([
      'household',
      householdId,
      'ledger',
      'month',
      2026,
      7,
    ])
  })

  it('keeps entity detail keys below their feature-list roots', () => {
    expect(queryKeys.groceries.list(householdId, 'list-1')).toEqual([
      'household',
      householdId,
      'groceries',
      'list',
      'list-1',
    ])
    expect(queryKeys.trips.trip(householdId, 'trip-1')).toEqual([
      'household',
      householdId,
      'trips',
      'trip',
      'trip-1',
    ])
  })
})
