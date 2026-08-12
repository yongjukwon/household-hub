import { describe, expect, it } from 'vitest'
import {
  buildCalendarEventPayload,
  emptyNoteDocument,
  expenseBuckets,
  householdTotalCents,
  mapBookingEntry,
  mapLedgerAsset,
  mapNoteSummary,
  mapTrip,
  totalsByCurrency,
} from '@household-hub/application/feature-data'

describe('shared feature data', () => {
  it('maps notes and trips from database rows into client models', () => {
    expect(emptyNoteDocument()).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(mapNoteSummary({ id: 'n1', title: 'Plans', revision: 2, updated_at: 'now' })).toEqual({
      id: 'n1', title: 'Plans', revision: 2, updatedAt: 'now',
    })
    expect(mapTrip({
      id: 't1', name: 'London', destination: 'London', destination_currency: 'GBP',
      destination_timezone: 'Europe/London', start_date: '2027-04-21', end_date: '2027-04-28', revision: 1,
    }).destinationCurrency).toBe('GBP')
  })

  it('builds calendar payloads without inactive time fields', () => {
    expect(buildCalendarEventPayload({
      id: 'e1', ownerId: null, title: '  Dinner ', note: ' ', allDay: true,
      startAt: null, endAt: null, startDate: '2027-04-21', endDate: '2027-04-21',
      timezone: 'America/Vancouver', recurrenceFrequency: 'none', recurrenceUntil: null,
      reminders: ['none'],
    })).toEqual(expect.objectContaining({
      title: 'Dinner', startDate: '2027-04-21', endDate: '2027-04-21',
    }))
    expect(buildCalendarEventPayload({
      id: 'e1', ownerId: null, title: 'Dinner', note: null, allDay: false,
      startAt: '2027-04-21T19:00:00Z', endAt: null, startDate: null, endDate: null,
      timezone: 'America/Vancouver', recurrenceFrequency: 'none', recurrenceUntil: null,
      reminders: ['none'],
    })).not.toHaveProperty('startDate')
  })

  it('keeps ledger currency totals and trip buckets deterministic', () => {
    const assets = [
      mapLedgerAsset({ id: 'a1', name: 'CAD', kind: 'cash', currency_code: 'CAD', balance_cents: 100, sort_order: 1, revision: 1 })!,
      mapLedgerAsset({ id: 'a2', name: 'USD', kind: 'cash', currency_code: 'USD', balance_cents: 50, sort_order: 2, revision: 1 })!,
    ]
    expect(householdTotalCents(assets)).toBe(100)
    expect(totalsByCurrency(assets).map((total) => total.currencyCode)).toEqual(['CAD', 'USD'])
    expect(expenseBuckets([{ id: 'e', tripId: 't', assetId: 'a', amountCents: 250, currencyCode: 'GBP', description: '', spentAt: '', itineraryEntryId: null, bookingEntryId: null, revision: 1 }])).toHaveLength(1)
    expect(mapBookingEntry({ id: 'b', trip_id: 't', kind: 'hotel', title: 'Stay', confirmation_number: null, address: null, starts_at: null, ends_at: null, notes: null, sort_order: 0, revision: 1 }).kind).toBe('hotel')
  })
})
