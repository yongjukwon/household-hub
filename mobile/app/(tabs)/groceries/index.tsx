import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DetailListRow } from '@/components/DetailListRow'
import { FloatingActionButton } from '@/components/FloatingActionButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { useGroceryLists, type GroceryList } from '@/features/groceries/data'
import {
  deleteGroceryList,
  saveGroceryList,
} from '@/features/groceries/mutations'
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
  const [deleting, setDeleting] = useState<GroceryList | null>(null)

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

  async function confirmDelete() {
    if (!householdId || !deleting) return
    await deleteGroceryList(householdId, deleting.id, deleting.revision)
    setDeleting(null)
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
      <FlatList
        data={lists.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
          <DetailListRow
            title={item.name}
            openLabel={`Open ${item.name}`}
            deleteLabel={`Delete ${item.name}`}
            onOpen={() => openList(item)}
            onDelete={() => setDeleting(item)}
          />
        )}
        ItemSeparatorComponent={() => <Text style={styles.separator} />}
      />

      <FloatingActionButton accessibilityLabel="New list" onPress={() => setAdding(true)} />

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

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? 'list'}?`}
        description="This permanently removes the list and all of its items."
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 90, flexGrow: 1 },
  separator: { height: 8 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  createButton: { paddingVertical: 13, alignItems: 'center' },
  createButtonText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
})
