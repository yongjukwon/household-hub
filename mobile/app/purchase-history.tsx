import { formatMoney } from '@household-hub/domain'
import { Stack } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { Card } from '@/components/Card'
import { GradientBackground } from '@/components/GradientBackground'
import { ListCard } from '@/components/ListCard'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import {
  calculateUnitPriceCents,
  useHouseholdPurchaseHistory,
  type PriceHistoryEntry,
} from '@/features/groceries/data'
import {
  PURCHASE_HISTORY_WINDOW_DAYS,
  filterPurchasedItems,
  purchaseStoreLabel,
  purchasedItemSummaries,
  recentPurchasesForItem,
  type PurchasedItemSummary,
} from '@/features/groceries/purchaseHistory'
import { useTheme } from '@/theme/tokens'

/**
 * Household-wide Purchase history: every item ever bought, searchable, with a
 * per-item view of the last year's occurrences. A standalone route reached
 * from More — not a tab destination — so the configurable three destinations
 * are untouched.
 *
 * Purchases are immutable snapshots, so this screen never resolves a live
 * grocery item or list: an item bought on a list that has since been deleted
 * still shows its name, its store, and what was paid.
 */
export default function PurchaseHistoryScreen() {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()
  // Approximate iOS compact-header height; see the same note in settings.tsx.
  const headerHeight = insets.top + 44
  const household = useActiveHousehold()
  const query = useHouseholdPurchaseHistory(household.data?.id)

  const [search, setSearch] = useState('')
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const history = useMemo(() => query.data ?? [], [query.data])
  const items = useMemo(() => purchasedItemSummaries(history), [history])
  const matches = useMemo(() => filterPurchasedItems(items, search), [items, search])
  const selected = selectedName
    ? (items.find((item) => item.normalizedName === selectedName) ?? null)
    : null
  const occurrences = useMemo(
    () => (selected ? recentPurchasesForItem(history, selected.normalizedName) : []),
    [history, selected],
  )

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['bottom']}>
      <GradientBackground />
      <Stack.Screen
        options={{
          headerShown: true,
          title: selected ? selected.displayName : 'Purchase history',
          headerTitleAlign: 'center',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerTintColor: tokens.ink,
          headerTitleStyle: { color: tokens.ink },
        }}
      />
      {query.isLoading ? (
        <View style={[styles.stateWrap, { paddingTop: headerHeight }]}>
          <LoadingState />
        </View>
      ) : query.isError ? (
        <View style={[styles.stateWrap, { paddingTop: headerHeight }]}>
          <ErrorState
            message="Could not load purchase history."
            onRetry={() => void query.refetch()}
          />
        </View>
      ) : selected ? (
        <ItemOccurrences
          item={selected}
          occurrences={occurrences}
          paddingTop={headerHeight}
          onBack={() => setSelectedName(null)}
        />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.normalizedName}
          contentContainerStyle={[styles.listContent, { paddingTop: headerHeight }]}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <Card style={styles.searchCard}>
                <TextInput
                  accessibilityLabel="Search purchased items"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search items"
                  placeholderTextColor={tokens.muted3}
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={[
                    styles.searchInput,
                    {
                      borderColor: tokens.line,
                      borderRadius: tokens.radiusControl,
                      color: tokens.ink,
                    },
                  ]}
                />
              </Card>
              {items.length === 0 ? (
                <EmptyState
                  title="No purchases yet"
                  hint="Check off a grocery item with a price and it shows up here."
                />
              ) : matches.length === 0 ? (
                <EmptyState
                  title="No matching items"
                  hint="No purchased item matches that search."
                />
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <ItemRow item={item} onOpen={() => setSelectedName(item.normalizedName)} />
          )}
        />
      )}
    </SafeAreaView>
  )
}

function ItemRow({
  item,
  onOpen,
}: {
  item: PurchasedItemSummary
  onOpen: () => void
}) {
  const { tokens } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.displayName} purchase history`}
      onPress={onOpen}
    >
      <ListCard style={styles.itemRow}>
        <View style={styles.itemNameCol}>
          <Text style={[styles.itemName, { color: tokens.ink }]}>{item.displayName}</Text>
          <Text style={[styles.itemMeta, { color: tokens.muted }]}>
            Last bought {formatPurchaseDate(item.lastPurchasedAt)}
          </Text>
        </View>
        <Text style={[styles.itemPrice, { color: tokens.ink }]}>
          {formatMoney(item.latestUnitPriceCents, 'CAD')} each
        </Text>
      </ListCard>
    </Pressable>
  )
}

function ItemOccurrences({
  item,
  occurrences,
  paddingTop,
  onBack,
}: {
  item: PurchasedItemSummary
  occurrences: PriceHistoryEntry[]
  paddingTop: number
  onBack: () => void
}) {
  const { tokens } = useTheme()
  return (
    <FlatList
      data={occurrences}
      keyExtractor={(entry) => entry.id}
      contentContainerStyle={[styles.listContent, { paddingTop }]}
      ListHeaderComponent={
        <View style={styles.detailHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to all items" onPress={onBack} hitSlop={6}>
            <Text style={[styles.backText, { color: tokens.accent }]}>All items</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            accessibilityLabel={`${item.displayName} purchase occurrences`}
            style={[styles.detailTitle, { color: tokens.muted }]}
          >
            {item.displayName} · last {PURCHASE_HISTORY_WINDOW_DAYS} days
          </Text>
          {occurrences.length === 0 ? (
            <EmptyState
              title="No purchases in the last year"
              hint={`${item.displayName} was last bought ${formatPurchaseDate(item.lastPurchasedAt)}.`}
            />
          ) : null}
        </View>
      }
      renderItem={({ item: entry }) => <OccurrenceRow entry={entry} />}
    />
  )
}

function OccurrenceRow({ entry }: { entry: PriceHistoryEntry }) {
  const { tokens } = useTheme()
  const unitPriceCents = calculateUnitPriceCents(
    entry.totalPriceCents,
    entry.purchaseQuantity,
  )
  return (
    <ListCard style={styles.itemRow}>
      <View style={styles.itemNameCol}>
        <Text style={[styles.itemPrice, { color: tokens.ink }]}>
          {formatMoney(unitPriceCents, 'CAD')} each
        </Text>
        <Text style={[styles.itemMeta, { color: tokens.muted }]}>
          {String(entry.purchaseQuantity)} × {formatMoney(entry.totalPriceCents, 'CAD')}
        </Text>
      </View>
      <View style={styles.occurrenceMetaCol}>
        <Text
          accessibilityLabel={`Bought at ${purchaseStoreLabel(entry)}`}
          style={[styles.itemMeta, styles.occurrenceMeta, { color: tokens.ink }]}
        >
          {purchaseStoreLabel(entry)}
        </Text>
        <Text style={[styles.itemMeta, styles.occurrenceMeta, { color: tokens.muted }]}>
          {formatPurchaseDate(entry.recordedAt)}
        </Text>
      </View>
    </ListCard>
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
  stateWrap: { flex: 1, paddingHorizontal: 20 },
  listContent: { padding: 20, paddingBottom: 40 },
  searchCard: { marginBottom: 16, padding: 12 },
  searchInput: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemNameCol: { flexShrink: 1 },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemMeta: { fontSize: 12.5, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700' },
  occurrenceMetaCol: { alignItems: 'flex-end', flexShrink: 1 },
  occurrenceMeta: { textAlign: 'right' },
  detailHeader: { marginBottom: 12 },
  backText: { fontSize: 14, fontWeight: '600' },
  detailTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 10,
  },
})
