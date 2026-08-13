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
import { useAppChrome } from '@/components/AppChrome'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DetailListRow } from '@/components/DetailListRow'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { useGroceryLists, type GroceryList } from '@/features/groceries/data'
import {
  deleteGroceryList,
  saveGroceryList,
} from '@/features/groceries/mutations'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
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
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function addList() {
    if (!householdId || name.trim().length === 0) return
    setSaving(true)
    setFormError(null)
    try {
      const sortOrder = lists.data?.length ?? 0
      const outcome = await saveGroceryList(
        householdId,
        { id: newUuid(), name, sortOrder },
        null,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setFormError(outcomeError)
        return
      }
      setName('')
      setAdding(false)
    } catch (error) {
      setFormError(operationThrownError(error, 'Could not create this list.'))
    } finally {
      setSaving(false)
    }
  }

  function openList(list: GroceryList) {
    router.push({ pathname: '/groceries/[listId]', params: { listId: list.id } })
  }

  async function confirmDelete() {
    if (!householdId || !deleting) return
    setSaving(true)
    setDeleteError(null)
    try {
      const outcome = await deleteGroceryList(
        householdId,
        deleting.id,
        deleting.revision,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setDeleteError(outcomeError)
        return
      }
      setDeleting(null)
    } catch (error) {
      setDeleteError(operationThrownError(error, 'Could not delete this list.'))
    } finally {
      setSaving(false)
    }
  }

  useAppChrome({ mode: 'root', title: 'Groceries', onAdd: () => setAdding(true) })

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['bottom']}>
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
            onDelete={() => {
              setDeleteError(null)
              setDeleting(item)
            }}
          />
        )}
        ItemSeparatorComponent={() => <Text style={styles.separator} />}
      />

      <BottomSheet
        open={adding}
        onOpenChange={(open) => {
          setAdding(open)
          if (!open) setFormError(null)
        }}
        title="New list"
      >
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
        {formError ? (
          <Text style={[styles.error, { color: tokens.danger }]}>{formError}</Text>
        ) : null}
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
          if (!open && !saving) {
            setDeleteError(null)
            setDeleting(null)
          }
        }}
        title={`Delete ${deleting?.name ?? 'list'}?`}
        description="This permanently removes the list and all of its items."
        error={deleteError}
        confirmLabel="Delete"
        confirmDisabled={saving}
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
  error: { fontSize: 13, marginBottom: 10 },
})
