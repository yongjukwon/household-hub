import { formatMoney } from '@household-hub/domain'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Card } from '@/components/Card'
import { ChevronLeftIcon } from '@/components/icons'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EditableTitle } from '@/components/EditableTitle'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import {
  cheapestPriceHistory,
  groceryNameSuggestions,
  latestPriceByName,
  normalizeItemName,
  sortGroceryItems,
  useGroceryList,
  useGroceryLists,
  type GroceryItem,
} from '@/features/groceries/data'
import {
  clearCheckedItems,
  deleteGroceryList,
  saveGroceryList,
  saveGroceryItem,
  toggleGroceryItem,
} from '@/features/groceries/mutations'
import { ItemSheet } from '@/features/groceries/ItemSheet'
import { operationOutcomeError } from '@/lib/operations'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'

/** Grocery list detail: items, checked handling, prices, and price history. */
export default function GroceryListScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const { listId } = useLocalSearchParams<{ listId: string }>()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const lists = useGroceryLists(householdId)
  const list = lists.data?.find((l) => l.id === listId)
  const query = useGroceryList(householdId, listId)

  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [editing, setEditing] = useState<GroceryItem | null>(null)
  const [historyItem, setHistoryItem] = useState<GroceryItem | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDeleteList, setConfirmDeleteList] = useState(false)
  const [busy, setBusy] = useState(false)

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items])
  const latest = useMemo(() => latestPriceByName(query.data?.history ?? []), [query.data])
  const { unchecked, checked } = useMemo(() => sortGroceryItems(items), [items])
  const knownNames = useMemo(
    () => groceryNameSuggestions(query.data?.knowledgeItems ?? items, query.data?.history ?? []),
    [items, query.data],
  )
  const matchingNames = newName.trim()
    ? knownNames
        .filter((name) => normalizeItemName(name).includes(normalizeItemName(newName)))
        .filter((name) => normalizeItemName(name) !== normalizeItemName(newName))
        .slice(0, 6)
    : []
  const suggestion = newName.trim() ? latest.get(normalizeItemName(newName)) : undefined
  const selectedHistory = historyItem
    ? cheapestPriceHistory(query.data?.history ?? [], normalizeItemName(historyItem.name))
    : []

  async function renameList(next: string): Promise<string | null> {
    if (!householdId || !list) return 'The list is not available.'
    const outcome = await saveGroceryList(householdId, { ...list, name: next }, list.revision)
    return operationOutcomeError(outcome)
  }

  async function addItem() {
    if (!householdId || !listId || newName.trim().length === 0) return
    setBusy(true)
    try {
      await saveGroceryItem(
        householdId,
        {
          id: newUuid(),
          listId,
          name: newName,
          quantity: null,
          checked: false,
          unitPriceCents: parseDollarsToCents(newPrice),
          sortOrder: items.length,
        },
        null,
      )
      setNewName('')
      setNewPrice('')
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    if (!householdId) return
    setBusy(true)
    try {
      await clearCheckedItems(householdId, items)
      setConfirmClear(false)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteList() {
    if (!householdId || !list) return
    setBusy(true)
    try {
      await deleteGroceryList(householdId, list.id, list.revision)
      router.replace('/groceries')
    } finally {
      setBusy(false)
    }
  }

  const rows: Array<{ kind: 'item'; item: GroceryItem } | { kind: 'checkedHeading' }> = [
    ...unchecked.map((item) => ({ kind: 'item' as const, item })),
    ...(checked.length > 0 ? [{ kind: 'checkedHeading' as const }] : []),
    ...checked.map((item) => ({ kind: 'item' as const, item })),
  ]

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(row, i) => (row.kind === 'item' ? row.item.id : `heading-${i}`)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/groceries')}
              style={styles.backRow}
            >
              <ChevronLeftIcon size={16} color={tokens.muted} />
              <Text style={[styles.backLabel, { color: tokens.muted }]}>All lists</Text>
            </Pressable>

            <View style={styles.titleRow}>
              {list ? (
                <EditableTitle
                  value={list.name}
                  accessibilityLabel="Grocery list name"
                  onSave={renameList}
                />
              ) : (
                <Text style={[styles.pageTitle, { color: tokens.ink }]}>List</Text>
              )}
              <View style={styles.headerActions}>
                {checked.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirmClear(true)}
                    hitSlop={6}
                  >
                    <Text style={[styles.headerActionText, { color: tokens.muted }]}>
                      Clear checked
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmDeleteList(true)}
                  hitSlop={6}
                >
                  <Text style={[styles.headerActionText, { color: tokens.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>

            <Card style={styles.addCard}>
              <View style={styles.addRow}>
                <TextInput
                  accessibilityLabel="Item name"
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Add an item"
                  placeholderTextColor={tokens.muted3}
                  onSubmitEditing={() => void addItem()}
                  style={[
                    styles.addNameInput,
                    { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
                  ]}
                />
                <TextInput
                  accessibilityLabel="Item price"
                  value={newPrice}
                  onChangeText={setNewPrice}
                  placeholder="$"
                  placeholderTextColor={tokens.muted3}
                  keyboardType="decimal-pad"
                  onSubmitEditing={() => void addItem()}
                  style={[
                    styles.addPriceInput,
                    { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
                  ]}
                />
              </View>
              {matchingNames.length > 0 ? (
                <View style={[styles.suggestions, { borderColor: tokens.line }]}>
                  {matchingNames.map((name) => (
                    <Pressable
                      key={normalizeItemName(name)}
                      accessibilityRole="button"
                      onPress={() => {
                        setNewName(name)
                        const known = latest.get(normalizeItemName(name))
                        if (known) setNewPrice(centsToInputValue(known.priceCents))
                      }}
                      style={styles.suggestionRow}
                    >
                      <Text style={[styles.suggestionText, { color: tokens.ink }]}>{name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {suggestion ? (
                <Text style={[styles.lastPrice, { color: tokens.muted }]}>
                  Last time: {formatMoney(suggestion.priceCents, 'CAD')}
                </Text>
              ) : null}
            </Card>

            {query.isLoading ? (
              <LoadingState />
            ) : query.isError ? (
              <ErrorState message="Could not load items." onRetry={() => void query.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState title="Empty list" hint="Add your first item above." />
            ) : null}
          </View>
        }
        renderItem={({ item: row }) =>
          row.kind === 'checkedHeading' ? (
            <Text style={[styles.checkedHeading, { color: tokens.muted }]}>
              Checked ({checked.length})
            </Text>
          ) : (
            <ItemRow
              item={row.item}
              householdId={householdId!}
              onEdit={() => setEditing(row.item)}
              onHistory={() => setHistoryItem(row.item)}
            />
          )
        }
        ListFooterComponent={
          historyItem ? (
            <Card style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={[styles.historyTitle, { color: tokens.muted }]}>
                  Five cheapest · {historyItem.name}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => setHistoryItem(null)}>
                  <Text style={[styles.historyClose, { color: tokens.muted }]}>Close</Text>
                </Pressable>
              </View>
              {selectedHistory.length === 0 ? (
                <Text style={[styles.historyEmpty, { color: tokens.muted }]}>
                  No purchase prices recorded yet.
                </Text>
              ) : (
                selectedHistory.map((entry) => (
                  <View key={entry.id} style={styles.historyRow}>
                    <Text style={[styles.historyPrice, { color: tokens.ink }]}>
                      {formatMoney(entry.priceCents, 'CAD')}
                    </Text>
                    <Text style={[styles.historyMeta, { color: tokens.muted }]}>
                      {entry.listName} · {formatPurchaseDate(entry.recordedAt)}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          ) : null
        }
      />

      {editing && householdId && listId ? (
        <ItemSheet
          key={`${editing.id}:${editing.revision}`}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          householdId={householdId}
          listId={listId}
          item={editing}
          sortOrder={editing.sortOrder}
        />
      ) : null}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear checked items?"
        description="This permanently removes the checked items from this list."
        confirmLabel="Clear"
        onConfirm={() => void handleClear()}
      />
      <ConfirmDialog
        open={confirmDeleteList}
        onOpenChange={setConfirmDeleteList}
        title="Delete this list?"
        description="This removes the list and all its items. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void handleDeleteList()}
      />
      {busy ? <Text accessibilityRole="text" style={styles.srOnly}>Working…</Text> : null}
    </SafeAreaView>
  )
}

function ItemRow({
  item,
  householdId,
  onEdit,
  onHistory,
}: {
  item: GroceryItem
  householdId: string
  onEdit: () => void
  onHistory: () => void
}) {
  const { tokens } = useTheme()
  return (
    <Card style={styles.itemRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={`Check ${item.name}`}
        onPress={() => void toggleGroceryItem(householdId, item, !item.checked)}
        style={[
          styles.checkbox,
          {
            borderColor: item.checked ? 'transparent' : tokens.line,
            backgroundColor: item.checked ? tokens.accent : 'transparent',
          },
        ]}
      >
        {item.checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </Pressable>
      <Pressable onPress={onHistory} style={styles.itemMain}>
        <View style={styles.itemNameCol}>
          <Text
            style={[
              styles.itemName,
              {
                color: item.checked ? tokens.muted : tokens.ink,
                textDecorationLine: item.checked ? 'line-through' : 'none',
              },
            ]}
          >
            {item.name}
            {item.quantity ? (
              <Text style={[styles.itemQty, { color: tokens.muted }]}> ×{item.quantity}</Text>
            ) : null}
          </Text>
          {item.checkedAt ? (
            <Text style={[styles.itemPurchased, { color: tokens.muted }]}>
              Purchased {formatPurchaseDate(item.checkedAt)}
            </Text>
          ) : null}
        </View>
        {item.unitPriceCents !== null ? (
          <Text style={[styles.itemPrice, { color: tokens.muted }]}>
            {formatMoney(item.unitPriceCents, 'CAD')}
          </Text>
        ) : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} onPress={onEdit} hitSlop={6}>
        <Text style={[styles.editLink, { color: tokens.muted }]}>Edit</Text>
      </Pressable>
    </Card>
  )
}

function formatPurchaseDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 120 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10 },
  backLabel: { fontSize: 13, fontWeight: '600' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  pageTitle: { fontSize: 22, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 12, paddingTop: 4 },
  headerActionText: { fontSize: 13, fontWeight: '600' },
  addCard: { marginBottom: 16, padding: 12 },
  addRow: { flexDirection: 'row', gap: 8 },
  addNameInput: { flex: 1, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  addPriceInput: { width: 84, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  suggestions: { marginTop: 8, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  suggestionRow: { paddingHorizontal: 12, paddingVertical: 9 },
  suggestionText: { fontSize: 14 },
  lastPrice: { marginTop: 8, fontSize: 12 },
  checkedHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemNameCol: { flexShrink: 1 },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemQty: { fontSize: 13, fontWeight: '400' },
  itemPurchased: { fontSize: 11, marginTop: 2 },
  itemPrice: { fontSize: 13, fontWeight: '600' },
  editLink: { fontSize: 12, fontWeight: '600' },
  historyCard: { marginTop: 8 },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  historyClose: { fontSize: 13 },
  historyEmpty: { fontSize: 13 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  historyPrice: { fontSize: 14, fontWeight: '700' },
  historyMeta: { fontSize: 13, textAlign: 'right' },
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
})
