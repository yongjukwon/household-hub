/** Stable React Query key factories shared by web and native clients. */
export const queryKeys = {
  household: (householdId: string) => ['household', householdId] as const,
  calendar: {
    month: (householdId: string, year: number, month: number) =>
      ['household', householdId, 'calendar', 'month', year, month] as const,
  },
  groceries: {
    lists: (householdId: string) => ['household', householdId, 'groceries'] as const,
    list: (householdId: string, listId: string) =>
      ['household', householdId, 'groceries', 'list', listId] as const,
    /** Household-wide purchase history, not scoped to any one list. */
    purchaseHistory: (householdId: string) =>
      ['household', householdId, 'groceries', 'purchase-history'] as const,
  },
  ledger: {
    years: (householdId: string) => ['household', householdId, 'ledger', 'years'] as const,
    year: (householdId: string, year: number) =>
      ['household', householdId, 'ledger', 'year', year] as const,
    month: (householdId: string, year: number, month: number) =>
      ['household', householdId, 'ledger', 'month', year, month] as const,
    assets: (householdId: string) => ['household', householdId, 'ledger', 'assets'] as const,
  },
  notes: {
    list: (householdId: string) => ['household', householdId, 'notes'] as const,
    note: (householdId: string, noteId: string) =>
      ['household', householdId, 'notes', 'note', noteId] as const,
  },
  trips: {
    list: (householdId: string) => ['household', householdId, 'trips'] as const,
    trip: (householdId: string, tripId: string) =>
      ['household', householdId, 'trips', 'trip', tripId] as const,
  },
  notifications: (householdId: string) =>
    ['household', householdId, 'notifications'] as const,
  settings: (householdId: string) => ['household', householdId, 'settings'] as const,
  outbox: (householdId: string) => ['household', householdId, 'outbox'] as const,
}
