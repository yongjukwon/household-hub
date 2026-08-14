import { formatMoney } from '@household-hub/domain'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
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
import { useAppChrome } from '@/components/AppChrome'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ListCard } from '@/components/ListCard'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { GroceryItemActions } from '@/features/groceries/GroceryItemActions'
import { useActiveHousehold } from '@/features/household'
import {
  calculateUnitPriceCents,
  displayedPriceHistory,
  groceryNameSuggestions,
  normalizeItemName,
  sortGroceryItems,
  useGroceryList,
  useGroceryLists,
  type GroceryItem,
  type PriceHistoryEntry,
} from '@/features/groceries/data'
import {
  clearCheckedItems,
  deleteGroceryItem,
  saveGroceryList,
  saveGroceryItem,
  toggleGroceryItem,
} from '@/features/groceries/mutations'
import { ItemSheet } from '@/features/groceries/ItemSheet'
import { PurchasePrompt } from '@/features/groceries/PurchasePrompt'
import { saveProfileSettings, useProfile } from '@/features/settings/profile'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'

/** Grocery list detail: items, checked handling, prices, and price history. */
export default function GroceryListScreen() {
  const { tokens } = useTheme()
  const { listId } = useLocalSearchParams<{ listId: string }>()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const lists = useGroceryLists(householdId)
  const list = lists.data?.find((l) => l.id === listId)
  const query = useGroceryList(householdId, listId)

  const [newName, setNewName] = useState('')
  const [renamingList, setRenamingList] = useState(false)
  const [listNameDraft, setListNameDraft] = useState('')
  const [editing, setEditing] = useState<GroceryItem | null>(null)
  const [historyItemId, setHistoryItemId] = useState<string | null>(null)
  const [purchaseItem, setPurchaseItem] = useState<GroceryItem | null>(null)
  const [unpricedWarningItem, setUnpricedWarningItem] = useState<GroceryItem | null>(null)
  const [suppressWarning, setSuppressWarning] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [deleteItem, setDeleteItem] = useState<GroceryItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingToggleItemIdsRef = useRef(new Set<string>())
  const [pendingToggleItemIds, setPendingToggleItemIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items])
  const profile = useProfile()
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

  async function renameList(next: string): Promise<string | null> {
    if (!householdId || !list) return 'The list is not available.'
    try {
      const outcome = await saveGroceryList(
        householdId,
        { ...list, name: next },
        list.revision,
      )
      return operationOutcomeError(outcome)
    } catch (failure) {
      return operationThrownError(failure, 'Could not rename this list.')
    }
  }

  function beginListRename() {
    if (!list) return
    setError(null)
    setListNameDraft(list.name)
    setRenamingList(true)
  }

  async function saveListRename() {
    const message = await renameList(listNameDraft)
    if (message) {
      setError(message)
      return
    }
    setRenamingList(false)
  }

  async function addItem() {
    if (!householdId || !listId || newName.trim().length === 0) return
    setBusy(true)
    setError(null)
    try {
      const outcome = await saveGroceryItem(
        householdId,
        {
          id: newUuid(),
          listId,
          name: newName,
          quantity: null,
          checked: false,
          unitPriceCents: null,
          purchaseQuantity: null,
          totalPriceCents: null,
          purchaseOccurrenceId: null,
          sortOrder: items.length,
        },
        null,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      setNewName('')
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not add this item.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    if (!householdId) return
    setBusy(true)
    setError(null)
    try {
      const outcomes = await clearCheckedItems(householdId, items)
      const outcomeError = outcomes
        .map(operationOutcomeError)
        .find((message) => message !== null)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      setConfirmClear(false)
    } catch (failure) {
      setError(
        operationThrownError(failure, 'Could not clear the checked items.'),
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteItem() {
    if (!householdId || !deleteItem) return
    setBusy(true)
    setError(null)
    try {
      const outcome = await deleteGroceryItem(
        householdId,
        deleteItem.id,
        deleteItem.revision,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      setDeleteItem(null)
      if (historyItemId === deleteItem.id) setHistoryItemId(null)
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not delete this item.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(item: GroceryItem) {
    if (!householdId) return
    if (pendingToggleItemIdsRef.current.has(item.id)) return
    if (!item.checked && (item.totalPriceCents === null || item.purchaseQuantity === null)) {
      setPurchaseItem(item)
      return
    }
    pendingToggleItemIdsRef.current.add(item.id)
    setPendingToggleItemIds(new Set(pendingToggleItemIdsRef.current))
    setError(null)
    try {
      const outcome = await toggleGroceryItem(
        householdId,
        item,
        !item.checked,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) setError(outcomeError)
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not update this item.'))
    } finally {
      pendingToggleItemIdsRef.current.delete(item.id)
      setPendingToggleItemIds(new Set(pendingToggleItemIdsRef.current))
    }
  }

  async function checkWithPrice(item: GroceryItem, quantity: number, totalPriceCents: number) {
    if (!householdId) return
    setBusy(true)
    setError(null)
    try {
      const outcome = await saveGroceryItem(householdId, {
        ...item,
        quantity: String(quantity),
        checked: true,
        purchaseQuantity: quantity,
        totalPriceCents,
        unitPriceCents: Math.round(calculateUnitPriceCents(totalPriceCents, quantity)),
        purchaseOccurrenceId: newUuid(),
      }, item.revision)
      const message = operationOutcomeError(outcome)
      if (message) setError(message)
      else setPurchaseItem(null)
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not record this purchase.'))
    } finally {
      setBusy(false)
    }
  }

  async function persistUnpricedCheck(item: GroceryItem): Promise<boolean> {
    if (!householdId) return false
    try {
      const outcome = await toggleGroceryItem(householdId, item, true)
      const message = operationOutcomeError(outcome)
      if (message) {
        setError(message)
        return false
      }
      setPurchaseItem(null)
      setUnpricedWarningItem(null)
      setSuppressWarning(false)
      return true
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not check this item.'))
      return false
    }
  }

  async function checkWithoutPrice(item: GroceryItem) {
    setBusy(true)
    setError(null)
    try {
      await persistUnpricedCheck(item)
    } finally {
      setBusy(false)
    }
  }

  async function confirmUnpricedCheck() {
    if (!unpricedWarningItem || !householdId) return
    setBusy(true)
    setError(null)
    try {
      if (suppressWarning) {
        if (!profile.data) {
          setError('Your profile is not available. Try again.')
          return
        }
        const outcome = await saveProfileSettings(
          householdId,
          profile.data.userId,
          { suppressUnpricedPurchaseWarning: true },
          profile.data.revision,
        )
        const message = operationOutcomeError(outcome)
        if (message) {
          setError(message)
          return
        }
      }
      await persistUnpricedCheck(unpricedWarningItem)
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not save this preference.'))
    } finally {
      setBusy(false)
    }
  }

  type Row = { kind: 'item'; item: GroceryItem } | { kind: 'history'; item: GroceryItem } | { kind: 'checkedHeading' }
  const withHistory = (source: GroceryItem[]): Row[] => source.flatMap((item) => [
    { kind: 'item' as const, item },
    ...(historyItemId === item.id ? [{ kind: 'history' as const, item }] : []),
  ])
  const rows: Row[] = [
    ...withHistory(unchecked),
    ...(checked.length > 0 ? [{ kind: 'checkedHeading' as const }] : []),
    ...withHistory(checked),
  ]

  useAppChrome({
    mode: renamingList ? 'editing' : 'detail',
    title: renamingList ? (
      <TextInput
        accessibilityLabel="Grocery list name"
        value={listNameDraft}
        onChangeText={setListNameDraft}
        autoFocus
        style={[
          styles.chromeTitleInput,
          { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
        ]}
      />
    ) : (list?.name ?? 'List'),
    onEdit: list ? beginListRename : undefined,
    onCancel: renamingList ? () => setRenamingList(false) : undefined,
    onSave: renamingList ? () => void saveListRename() : undefined,
  })

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(row) =>
          row.kind === 'item'
            ? row.item.id
            : row.kind === 'history'
              ? `${row.item.id}:history`
              : 'checked-heading'
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {checked.length > 0 ? (
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmClear(true)}
                  hitSlop={6}
                >
                  <Text style={[styles.headerActionText, { color: tokens.muted }]}>Clear checked</Text>
                </Pressable>
              </View>
            ) : null}

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
              </View>
              {matchingNames.length > 0 ? (
                <View style={[styles.suggestions, { borderColor: tokens.line }]}>
                  {matchingNames.map((name) => (
                    <Pressable
                      key={normalizeItemName(name)}
                      accessibilityRole="button"
                      onPress={() => {
                        setNewName(name)
                      }}
                      style={styles.suggestionRow}
                    >
                      <Text style={[styles.suggestionText, { color: tokens.ink }]}>{name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Card>
            {error && !confirmClear && !deleteItem && !purchaseItem && !unpricedWarningItem ? (
              <Text style={[styles.error, { color: tokens.danger }]}>
                {error}
              </Text>
            ) : null}

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
          ) : row.kind === 'history' ? (
            <HistoryPanel item={row.item} history={displayedPriceHistory(query.data?.history ?? [], normalizeItemName(row.item.name))} onClose={() => setHistoryItemId(null)} />
          ) : (
            <ItemRow
              item={row.item}
              togglePending={pendingToggleItemIds.has(row.item.id)}
              onToggle={() => void handleToggle(row.item)}
              onEdit={() => setEditing(row.item)}
              onDelete={() => {
                setError(null)
                setDeleteItem(row.item)
              }}
              onHistory={() => setHistoryItemId((current) => current === row.item.id ? null : row.item.id)}
            />
          )
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
      {purchaseItem ? (
        <PurchasePrompt
          item={purchaseItem}
          saving={busy}
          submissionError={unpricedWarningItem ? null : error}
          onCancel={() => {
            setError(null)
            setPurchaseItem(null)
          }}
          onSavePrice={(quantity, total) => void checkWithPrice(purchaseItem, quantity, total)}
          onCheckWithoutPrice={() => {
            if (profile.data?.suppressUnpricedPurchaseWarning) void checkWithoutPrice(purchaseItem)
            else {
              setError(null)
              setSuppressWarning(false)
              setUnpricedWarningItem(purchaseItem)
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={unpricedWarningItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setError(null)
            setSuppressWarning(false)
            setUnpricedWarningItem(null)
          }
        }}
        title="Check without a price?"
        description="This purchase will not enter price history."
        error={unpricedWarningItem ? error : null}
        confirmLabel="Check without price"
        confirmDisabled={busy}
        destructive={false}
        onConfirm={() => void confirmUnpricedCheck()}
      >
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: suppressWarning }} onPress={() => setSuppressWarning((value) => !value)}>
          <Text style={{ color: tokens.ink }}>{suppressWarning ? '☑' : '☐'} Don’t show this warning again</Text>
        </Pressable>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear checked items?"
        description="This permanently removes the checked items from this list."
        error={confirmClear ? error : null}
        confirmLabel="Clear"
        confirmDisabled={busy}
        onConfirm={() => void handleClear()}
      />
      <ConfirmDialog
        open={deleteItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null)
        }}
        title={`Delete ${deleteItem?.name ?? 'this item'}?`}
        description="This permanently removes the item from this grocery list."
        error={error}
        confirmLabel="Delete"
        confirmDisabled={busy}
        onConfirm={() => void handleDeleteItem()}
      />
      {busy ? <Text accessibilityRole="text" style={styles.srOnly}>Working…</Text> : null}
    </SafeAreaView>
  )
}

function ItemRow({
  item,
  togglePending,
  onToggle,
  onEdit,
  onDelete,
  onHistory,
}: {
  item: GroceryItem
  togglePending: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onHistory: () => void
}) {
  const { tokens } = useTheme()
  return (
    <ListCard style={styles.itemRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked, disabled: togglePending }}
        accessibilityLabel={`Check ${item.name}`}
        disabled={togglePending}
        onPress={onToggle}
        style={[
          styles.checkbox,
          {
            borderColor: item.checked ? 'transparent' : tokens.line,
            backgroundColor: item.checked ? tokens.accent : 'transparent',
          },
          togglePending && styles.togglePending,
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
            {formatMoney(
              item.totalPriceCents !== null && item.purchaseQuantity !== null
                ? calculateUnitPriceCents(item.totalPriceCents, item.purchaseQuantity)
                : item.unitPriceCents,
              'CAD',
            )}
          </Text>
        ) : null}
      </Pressable>
      <GroceryItemActions itemName={item.name} onHistory={onHistory} onEdit={onEdit} onDelete={onDelete} />
    </ListCard>
  )
}

function HistoryPanel({
  item,
  history,
  onClose,
}: {
  item: GroceryItem
  history: PriceHistoryEntry[]
  onClose: () => void
}) {
  const { tokens } = useTheme()
  return (
    <Card style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <Text style={[styles.historyTitle, { color: tokens.muted }]}>Price history · {item.name}</Text>
        <Pressable accessibilityRole="button" onPress={onClose}>
          <Text style={[styles.historyClose, { color: tokens.muted }]}>Close</Text>
        </Pressable>
      </View>
      {history.length === 0 ? (
        <Text style={[styles.historyEmpty, { color: tokens.muted }]}>No purchase prices recorded yet.</Text>
      ) : history.map((entry) => (
        <View key={entry.id} style={styles.historyRow}>
          <View>
            <Text style={[styles.historyPrice, { color: tokens.ink }]}>
              {formatMoney(calculateUnitPriceCents(entry.totalPriceCents, entry.purchaseQuantity), 'CAD')} each
            </Text>
            <Text style={[styles.historyMeta, { color: tokens.muted }]}>{entry.purchaseQuantity} · {formatMoney(entry.totalPriceCents, 'CAD')} total</Text>
          </View>
          <Text style={[styles.historyMeta, { color: tokens.muted }]}>{entry.listName} · {formatPurchaseDate(entry.recordedAt)}</Text>
        </View>
      ))}
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
  listContent: { padding: 20, paddingBottom: 24 },
  headerActions: { alignItems: 'flex-end', marginBottom: 10 },
  error: { fontSize: 13, marginBottom: 10 },
  headerActionText: { fontSize: 13, fontWeight: '600' },
  chromeTitleInput: { width: 220, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, fontSize: 16, fontWeight: '700' },
  addCard: { marginBottom: 16, padding: 12 },
  addRow: { flexDirection: 'row', gap: 8 },
  addNameInput: { flex: 1, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  suggestions: { marginTop: 8, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  suggestionRow: { paddingHorizontal: 12, paddingVertical: 9 },
  suggestionText: { fontSize: 14 },
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
  togglePending: { opacity: 0.5 },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemNameCol: { flexShrink: 1 },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemQty: { fontSize: 13, fontWeight: '400' },
  itemPurchased: { fontSize: 11, marginTop: 2 },
  itemPrice: { fontSize: 13, fontWeight: '600' },
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
