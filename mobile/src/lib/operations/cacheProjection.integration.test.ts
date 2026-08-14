import { queryKeys } from '@household-hub/domain'
import {
  persistQueryClientRestore,
  persistQueryClientSave,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core'

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }))
jest.mock('@/lib/net', () => ({
  isOnline: jest.fn(),
  onReconnect: jest.fn(() => jest.fn()),
}))
jest.mock('@/lib/secure', () => {
  const store: Record<string, string> = {}
  return {
    getSecureItem: async (key: string) => store[key] ?? null,
    setSecureItem: async (key: string, value: string) => {
      store[key] = value
    },
    deleteSecureItem: async (key: string) => {
      delete store[key]
    },
  }
})

import { supabase } from '@/lib/supabase'
import { isOnline } from '@/lib/net'
import { createQueryClient } from '@/lib/query'
import {
  MOBILE_QUERY_CACHE_BUSTER,
  createQueryPersister,
} from '@/lib/queryPersister'
import type { QueryCacheStore } from '@/lib/db/sqlite'
import type { Profile } from '@/features/settings/profile'
import { saveProfileSettings } from '@/features/settings/profile'
import type {
  GroceryItem,
  GroceryKnowledgeItem,
  GroceryList,
  PriceHistoryEntry,
} from '@/features/groceries/data'
import {
  deleteGroceryItem,
  saveGroceryItem,
} from '@/features/groceries/mutations'
import {
  InMemoryOperationStore,
  pendingOperations,
  resetDeviceIdentity,
  setOperationQueryClient,
  setOperationStore,
} from './index'

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const LIST_ID = '33333333-3333-4333-8333-333333333333'
const MILK_ID = '44444444-4444-4444-8444-444444444444'
const BREAD_ID = '55555555-5555-4555-8555-555555555555'
const PURCHASE_OCCURRENCE_ID = '66666666-6666-4666-8666-666666666666'
const PHARMACY_LIST_ID = '77777777-7777-4777-8777-777777777777'
const SOAP_ID = '88888888-8888-4888-8888-888888888888'
const HISTORY_ENTRY_ID = '99999999-9999-4999-8999-999999999999'
const PURCHASED_AT = '2026-01-01T00:00:00.000Z'

type GroceryListCache = {
  items: GroceryItem[]
  history: PriceHistoryEntry[]
  knowledgeItems: GroceryKnowledgeItem[]
}

function memoryQueryCacheStore(): QueryCacheStore & {
  value: string | null
} {
  return {
    value: null,
    async get() {
      return this.value
    },
    async set(_key, value) {
      this.value = value
    },
    async remove() {
      this.value = null
    },
  }
}

async function waitForPersistedValue(
  store: ReturnType<typeof memoryQueryCacheStore>,
  expectedText: string,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (store.value?.includes(expectedText)) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error(`Persisted query cache never contained ${expectedText}`)
}

const profile: Profile = {
  userId: USER_ID,
  displayName: 'Claire',
  appearance: 'system',
  notificationsEnabled: true,
  mobileNavigation: ['groceries', 'ledger', 'trips'],
  suppressUnpricedPurchaseWarning: false,
  revision: 4,
}

const groceryList: GroceryList = {
  id: LIST_ID,
  name: 'Market',
  sortOrder: 0,
  revision: 1,
}

const milk: GroceryItem = {
  id: MILK_ID,
  listId: LIST_ID,
  name: 'Milk',
  quantity: null,
  checked: false,
  checkedAt: null,
  unitPriceCents: null,
  purchaseQuantity: null,
  totalPriceCents: null,
  purchaseOccurrenceId: null,
  sortOrder: 0,
  revision: 1,
}

const pharmacyList: GroceryList = {
  id: PHARMACY_LIST_ID,
  name: 'Pharmacy',
  sortOrder: 1,
  revision: 1,
}

const soap: GroceryItem = {
  id: SOAP_ID,
  listId: PHARMACY_LIST_ID,
  name: 'Soap',
  quantity: null,
  checked: false,
  checkedAt: null,
  unitPriceCents: null,
  purchaseQuantity: null,
  totalPriceCents: null,
  purchaseOccurrenceId: null,
  sortOrder: 0,
  revision: 1,
}

/** Milk already bought in an earlier session: checked, priced, in history. */
const purchasedMilk: GroceryItem = {
  ...milk,
  checked: true,
  checkedAt: PURCHASED_AT,
  unitPriceCents: 400,
  purchaseQuantity: 2,
  totalPriceCents: 800,
  purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
  revision: 2,
}

const milkPurchaseHistory: PriceHistoryEntry = {
  id: HISTORY_ENTRY_ID,
  itemNameNormalized: 'milk',
  itemName: 'Milk',
  priceCents: 400,
  recordedAt: PURCHASED_AT,
  listName: 'Market',
  purchaseQuantity: 2,
  totalPriceCents: 800,
  sourceItemId: MILK_ID,
  purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
}

const mockRpc = supabase.rpc as jest.Mock
const mockIsOnline = isOnline as jest.Mock

beforeEach(async () => {
  setOperationStore(new InMemoryOperationStore())
  await setOperationQueryClient(null)
  await resetDeviceIdentity()
  mockRpc.mockReset()
  mockIsOnline.mockResolvedValue(false)
})

afterEach(async () => {
  await setOperationQueryClient(null)
  setOperationStore(null)
})

describe('durable operation query-cache projection', () => {
  it('projects navigation and warning suppression into the exact profile cache and persisted relaunch state', async () => {
    const client = createQueryClient()
    const store = memoryQueryCacheStore()
    const persister = createQueryPersister(store)
    client.setQueryData(['profile', USER_ID], profile)
    await setOperationQueryClient(client)
    const unsubscribe = persistQueryClientSubscribe({
      queryClient: client,
      persister,
      buster: MOBILE_QUERY_CACHE_BUSTER,
    })

    await saveProfileSettings(
      HOUSEHOLD_ID,
      USER_ID,
      { mobileNavigation: ['notes', 'trips', 'groceries'] },
      profile.revision,
    )
    await saveProfileSettings(
      HOUSEHOLD_ID,
      USER_ID,
      { suppressUnpricedPurchaseWarning: true },
      profile.revision,
    )

    expect(client.getQueryData<Profile>(['profile', USER_ID])).toMatchObject({
      mobileNavigation: ['notes', 'trips', 'groceries'],
      suppressUnpricedPurchaseWarning: true,
    })

    await waitForPersistedValue(store, 'suppressUnpricedPurchaseWarning')
    unsubscribe()
    const relaunchedClient = createQueryClient()
    await persistQueryClientRestore({
      queryClient: relaunchedClient,
      persister: createQueryPersister(store),
      buster: MOBILE_QUERY_CACHE_BUSTER,
      maxAge: Number.POSITIVE_INFINITY,
    })

    expect(
      relaunchedClient.getQueryData<Profile>(['profile', USER_ID]),
    ).toMatchObject({
      mobileNavigation: ['notes', 'trips', 'groceries'],
      suppressUnpricedPurchaseWarning: true,
    })
    expect(await pendingOperations()).toHaveLength(2)
  })

  it('invalidates the exact profile query only after an online settings operation settles', async () => {
    const client = createQueryClient()
    client.setQueryData(['profile', USER_ID], profile)
    await setOperationQueryClient(client)
    mockIsOnline.mockResolvedValue(true)
    mockRpc.mockImplementation(
      async (_name: string, args: { command: { operationId: string } }) => ({
        data: {
          status: 'applied',
          operationId: args.command.operationId,
          serverSequence: 1,
          entityRevision: 5,
        },
        error: null,
      }),
    )

    await saveProfileSettings(
      HOUSEHOLD_ID,
      USER_ID,
      { mobileNavigation: ['notes', 'trips', 'groceries'] },
      profile.revision,
    )

    expect(await pendingOperations()).toHaveLength(0)
    expect(
      client.getQueryState(['profile', USER_ID])?.isInvalidated,
    ).toBe(true)
  })

  it('projects offline Grocery add, check, remove, and purchase history through persisted relaunch', async () => {
    const client = createQueryClient()
    const store = memoryQueryCacheStore()
    const persister = createQueryPersister(store)
    const detailKey = queryKeys.groceries.list(HOUSEHOLD_ID, LIST_ID)
    const historyKey = queryKeys.groceries.purchaseHistory(HOUSEHOLD_ID)
    client.setQueryData<GroceryList[]>(
      queryKeys.groceries.lists(HOUSEHOLD_ID),
      [groceryList],
    )
    client.setQueryData<GroceryListCache>(detailKey, {
      items: [milk],
      history: [],
      knowledgeItems: [{ name: milk.name }],
    })
    await setOperationQueryClient(client)
    const unsubscribe = persistQueryClientSubscribe({
      queryClient: client,
      persister,
      buster: MOBILE_QUERY_CACHE_BUSTER,
    })

    await saveGroceryItem(
      HOUSEHOLD_ID,
      {
        id: BREAD_ID,
        listId: LIST_ID,
        name: 'Bread',
        quantity: null,
        checked: false,
        unitPriceCents: null,
        purchaseQuantity: null,
        totalPriceCents: null,
        purchaseOccurrenceId: null,
        sortOrder: 1,
      },
      null,
    )
    expect(
      client.getQueryData<GroceryListCache>(detailKey)?.items,
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: MILK_ID }),
      expect.objectContaining({ id: BREAD_ID, name: 'Bread' }),
    ]))

    await saveGroceryItem(
      HOUSEHOLD_ID,
      {
        ...milk,
        checked: true,
        unitPriceCents: 400,
        purchaseQuantity: 2,
        totalPriceCents: 800,
        purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
      },
      milk.revision,
    )
    expect(
      client.getQueryData<GroceryListCache>(detailKey)?.items,
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: MILK_ID,
        checked: true,
        purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
      }),
      expect.objectContaining({ id: BREAD_ID }),
    ]))
    expect(client.getQueryData<PriceHistoryEntry[]>(historyKey)).toEqual([
      expect.objectContaining({
        itemName: 'Milk',
        purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
      }),
    ])

    await deleteGroceryItem(HOUSEHOLD_ID, BREAD_ID, 1)

    const projected = client.getQueryData<GroceryListCache>(detailKey)
    expect(projected?.items).toEqual([
      expect.objectContaining({
        id: MILK_ID,
        checked: true,
        purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
      }),
    ])
    expect(projected?.history).toEqual([
      expect.objectContaining({
        itemName: 'Milk',
        listName: 'Market',
        purchaseQuantity: 2,
        totalPriceCents: 800,
        sourceItemId: MILK_ID,
        purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
      }),
    ])
    expect(client.getQueryData<PriceHistoryEntry[]>(historyKey)).toEqual(
      projected?.history,
    )

    await waitForPersistedValue(store, PURCHASE_OCCURRENCE_ID)
    unsubscribe()
    const relaunchedClient = createQueryClient()
    await persistQueryClientRestore({
      queryClient: relaunchedClient,
      persister: createQueryPersister(store),
      buster: MOBILE_QUERY_CACHE_BUSTER,
      maxAge: Number.POSITIVE_INFINITY,
    })

    expect(
      relaunchedClient.getQueryData<GroceryListCache>(detailKey),
    ).toEqual(projected)
    expect(
      relaunchedClient.getQueryData<PriceHistoryEntry[]>(historyKey),
    ).toEqual(projected?.history)
    expect(await pendingOperations()).toHaveLength(3)
  })

  it('replays the durable queue on relaunch when the persister never captured the enqueue-time projection', async () => {
    const client = createQueryClient()
    const store = memoryQueryCacheStore()
    const detailKey = queryKeys.groceries.list(HOUSEHOLD_ID, LIST_ID)
    const historyKey = queryKeys.groceries.purchaseHistory(HOUSEHOLD_ID)
    client.setQueryData<GroceryList[]>(
      queryKeys.groceries.lists(HOUSEHOLD_ID),
      [groceryList],
    )
    client.setQueryData<GroceryListCache>(detailKey, {
      items: [milk],
      history: [],
      knowledgeItems: [{ name: milk.name }],
    })
    // The only write the persister ever makes is this pre-command snapshot: no
    // subscription is attached afterwards, which is what an app killed inside
    // the persister's 1s throttle window leaves behind. The commands are
    // durable; their enqueue-time projection is not.
    await persistQueryClientSave({
      queryClient: client,
      persister: createQueryPersister(store),
      buster: MOBILE_QUERY_CACHE_BUSTER,
    })
    await setOperationQueryClient(client)

    await saveGroceryItem(
      HOUSEHOLD_ID,
      {
        id: BREAD_ID,
        listId: LIST_ID,
        name: 'Bread',
        quantity: null,
        checked: false,
        unitPriceCents: null,
        purchaseQuantity: null,
        totalPriceCents: null,
        purchaseOccurrenceId: null,
        sortOrder: 1,
      },
      null,
    )
    await saveGroceryItem(
      HOUSEHOLD_ID,
      {
        ...milk,
        checked: true,
        unitPriceCents: 400,
        purchaseQuantity: 2,
        totalPriceCents: 800,
        purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
      },
      milk.revision,
    )
    expect(await pendingOperations()).toHaveLength(2)

    const relaunchedClient = createQueryClient()
    await persistQueryClientRestore({
      queryClient: relaunchedClient,
      persister: createQueryPersister(store),
      buster: MOBILE_QUERY_CACHE_BUSTER,
      maxAge: Number.POSITIVE_INFINITY,
    })

    // Guard: the restored cache predates both commands, so the assertions
    // below can only be satisfied by the replay, never by a projection the
    // persister happened to have already written.
    expect(relaunchedClient.getQueryData<GroceryListCache>(detailKey)).toEqual({
      items: [milk],
      history: [],
      knowledgeItems: [{ name: milk.name }],
    })
    expect(
      relaunchedClient.getQueryData<PriceHistoryEntry[]>(historyKey),
    ).toBeUndefined()

    await setOperationQueryClient(relaunchedClient)

    const replayed = relaunchedClient.getQueryData<GroceryListCache>(detailKey)
    expect(replayed?.items).toEqual([
      expect.objectContaining({
        id: MILK_ID,
        checked: true,
        purchaseQuantity: 2,
        totalPriceCents: 800,
        purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
      }),
      expect.objectContaining({ id: BREAD_ID, name: 'Bread' }),
    ])
    expect(replayed?.knowledgeItems).toEqual(
      expect.arrayContaining([{ name: 'Bread' }]),
    )
    expect(replayed?.history).toEqual([
      expect.objectContaining({
        itemName: 'Milk',
        listName: 'Market',
        purchaseQuantity: 2,
        totalPriceCents: 800,
        sourceItemId: MILK_ID,
        purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
      }),
    ])
    expect(
      relaunchedClient.getQueryData<PriceHistoryEntry[]>(historyKey),
    ).toEqual(replayed?.history)
  })

  it('projects a queued item into its own list cache only, leaving a sibling list untouched', async () => {
    const client = createQueryClient()
    const marketKey = queryKeys.groceries.list(HOUSEHOLD_ID, LIST_ID)
    const pharmacyKey = queryKeys.groceries.list(HOUSEHOLD_ID, PHARMACY_LIST_ID)
    client.setQueryData<GroceryList[]>(
      queryKeys.groceries.lists(HOUSEHOLD_ID),
      [groceryList, pharmacyList],
    )
    client.setQueryData<GroceryListCache>(marketKey, {
      items: [milk],
      history: [],
      knowledgeItems: [{ name: milk.name }],
    })
    client.setQueryData<GroceryListCache>(pharmacyKey, {
      items: [soap],
      history: [],
      knowledgeItems: [{ name: soap.name }],
    })
    await setOperationQueryClient(client)

    await saveGroceryItem(
      HOUSEHOLD_ID,
      {
        id: BREAD_ID,
        listId: LIST_ID,
        name: 'Bread',
        quantity: null,
        checked: false,
        unitPriceCents: null,
        purchaseQuantity: null,
        totalPriceCents: null,
        purchaseOccurrenceId: null,
        sortOrder: 1,
      },
      null,
    )

    const market = client.getQueryData<GroceryListCache>(marketKey)
    expect(market?.items).toEqual([
      expect.objectContaining({ id: MILK_ID }),
      expect.objectContaining({ id: BREAD_ID, name: 'Bread', listId: LIST_ID }),
    ])
    expect(market?.knowledgeItems).toEqual([
      { name: 'Milk' },
      { name: 'Bread' },
    ])

    // The other list's cache is a different query: Bread must not appear in it,
    // and its own item must not be filtered out of it.
    const pharmacy = client.getQueryData<GroceryListCache>(pharmacyKey)
    expect(pharmacy?.items).toEqual([
      expect.objectContaining({ id: SOAP_ID, listId: PHARMACY_LIST_ID }),
    ])
    expect(pharmacy?.knowledgeItems).toEqual([{ name: 'Soap' }])
  })

  it('keeps the original checkedAt when an already-checked item is edited offline', async () => {
    const client = createQueryClient()
    const detailKey = queryKeys.groceries.list(HOUSEHOLD_ID, LIST_ID)
    const historyKey = queryKeys.groceries.purchaseHistory(HOUSEHOLD_ID)
    client.setQueryData<GroceryList[]>(
      queryKeys.groceries.lists(HOUSEHOLD_ID),
      [groceryList],
    )
    client.setQueryData<GroceryListCache>(detailKey, {
      items: [purchasedMilk],
      history: [milkPurchaseHistory],
      knowledgeItems: [{ name: purchasedMilk.name }],
    })
    client.setQueryData<PriceHistoryEntry[]>(historyKey, [milkPurchaseHistory])
    await setOperationQueryClient(client)

    // Correcting the price re-sends `checked: true` with a fresh optimistic
    // checkedAt; the purchase happened when it happened, so the cache must keep
    // the original timestamp rather than moving the item to "just now".
    await saveGroceryItem(
      HOUSEHOLD_ID,
      {
        ...purchasedMilk,
        unitPriceCents: 450,
        totalPriceCents: 900,
      },
      purchasedMilk.revision,
    )

    const projected = client.getQueryData<GroceryListCache>(detailKey)
    expect(projected?.items).toEqual([
      expect.objectContaining({
        id: MILK_ID,
        checked: true,
        checkedAt: PURCHASED_AT,
        totalPriceCents: 900,
      }),
    ])
    expect(projected?.history).toEqual([
      expect.objectContaining({
        id: HISTORY_ENTRY_ID,
        recordedAt: PURCHASED_AT,
        totalPriceCents: 900,
        purchaseOccurrenceId: PURCHASE_OCCURRENCE_ID,
      }),
    ])
    expect(client.getQueryData<PriceHistoryEntry[]>(historyKey)).toEqual(
      projected?.history,
    )
  })
})
