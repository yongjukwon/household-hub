import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BottomSheet } from '@/components/BottomSheet'
import { Card } from '@/components/Card'
import { ChevronRightIcon, PlusIcon } from '@/components/icons'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { useGroceryLists, type GroceryList } from '@/features/groceries/data'
import { saveGroceryList } from '@/features/groceries/mutations'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'

/** Groceries destination: the index of named lists. */
export default function GroceriesScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const lists = useGroceryLists(householdId)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function addList() {
    if (!householdId || name.trim().length === 0) return
    setSaving(true)
    try {
      const sortOrder = lists.data?.length ?? 0
      await saveGroceryList(householdId, { id: newUuid(), name, sortOrder }, null)
      setName('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  function openList(list: GroceryList) {
    router.push({ pathname: '/groceries/[listId]', params: { listId: list.id } })
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
      <FlatList
        data={lists.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={[styles.pageTitle, { color: tokens.ink }]}>
              Groceries
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New list"
              onPress={() => setAdding(true)}
              style={[styles.addButton, { backgroundColor: tokens.accent }]}
            >
              <PlusIcon size={18} color={tokens.accentContrast} />
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          lists.isLoading ? (
            <LoadingState />
          ) : lists.isError ? (
            <ErrorState message="Could not load your lists." onRetry={() => void lists.refetch()} />
          ) : (
            <EmptyState title="No lists yet" hint="Tap + to create a list." />
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => openList(item)} style={styles.rowWrap}>
            <Card style={styles.row}>
              <Text style={[styles.rowLabel, { color: tokens.ink }]}>{item.name}</Text>
              <ChevronRightIcon size={18} color={tokens.muted} />
            </Card>
          </Pressable>
        )}
      />

      <BottomSheet open={adding} onOpenChange={setAdding} title="New list">
        <TextInput
          accessibilityLabel="List name"
          value={name}
          onChangeText={setName}
          placeholder="List name"
          placeholderTextColor={tokens.muted3}
          autoFocus
          onSubmitEditing={() => void addList()}
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={saving || name.trim().length === 0}
          onPress={() => void addList()}
          style={[
            styles.createButton,
            { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl },
            (saving || name.trim().length === 0) && styles.disabled,
          ]}
        >
          <Text style={[styles.createButtonText, { color: tokens.accentContrast }]}>Create</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 120, flexGrow: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowWrap: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  createButton: { paddingVertical: 13, alignItems: 'center' },
  createButtonText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
})
