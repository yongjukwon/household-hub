import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BottomSheet } from '@/components/BottomSheet'
import { useAppChrome } from '@/components/AppChrome'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DetailListRow } from '@/components/DetailListRow'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { emptyNoteDocument, useNotes, type NoteSummary } from '@/features/notes/data'
import { deleteNote, saveNote } from '@/features/notes/mutations'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'

/** Notes destination: the index of named documents. */
export default function NotesScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const notes = useNotes(householdId)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<NoteSummary | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function addNote() {
    if (!householdId || title.trim().length === 0) return
    setSaving(true)
    setFormError(null)
    try {
      const outcome = await saveNote(
        householdId,
        { id: newUuid(), title, document: emptyNoteDocument() },
        null,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setFormError(outcomeError)
        return
      }
      setTitle('')
      setAdding(false)
    } catch (error) {
      setFormError(operationThrownError(error, 'Could not create this note.'))
    } finally {
      setSaving(false)
    }
  }

  function openNote(note: NoteSummary) {
    router.push({ pathname: '/notes/[noteId]', params: { noteId: note.id } })
  }

  async function confirmDelete() {
    if (!householdId || !deleting) return
    setSaving(true)
    setDeleteError(null)
    try {
      const outcome = await deleteNote(
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
      setDeleteError(operationThrownError(error, 'Could not delete this note.'))
    } finally {
      setSaving(false)
    }
  }

  useAppChrome({ mode: 'root', title: 'Notes', onAdd: () => setAdding(true) })

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['bottom']}>
      <FlatList
        data={notes.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          notes.isLoading ? (
            <LoadingState />
          ) : notes.isError ? (
            <ErrorState message="Could not load your notes." onRetry={() => void notes.refetch()} />
          ) : (
            <EmptyState title="No notes yet" hint="Tap + to create a note." />
          )
        }
        renderItem={({ item }) => (
          <DetailListRow
            title={item.title}
            openLabel={`Open ${item.title}`}
            deleteLabel={`Delete ${item.title}`}
            onOpen={() => openNote(item)}
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
        title="New note"
      >
        <TextInput
          accessibilityLabel="Note title"
          value={title}
          onChangeText={setTitle}
          placeholder="Note title"
          placeholderTextColor={tokens.muted3}
          autoFocus
          onSubmitEditing={() => void addNote()}
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
          disabled={saving || title.trim().length === 0}
          onPress={() => void addNote()}
          style={[
            styles.createButton,
            { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl },
            (saving || title.trim().length === 0) && styles.disabled,
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
        title={`Delete ${deleting?.title ?? 'note'}?`}
        description="This permanently removes the note."
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
