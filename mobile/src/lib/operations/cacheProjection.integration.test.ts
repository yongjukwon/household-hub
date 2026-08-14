import { queryKeys } from '@household-hub/domain'
import {
  persistQueryClientRestore,
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
})
