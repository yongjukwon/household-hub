import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DetailListRow } from '@/components/DetailListRow'
import { FloatingActionButton } from '@/components/FloatingActionButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { emptyNoteDocument, useNotes, type NoteSummary } from '@/features/notes/data'
import { deleteNote, saveNote } from '@/features/notes/mutations'
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

  async function addNote() {
    if (!householdId || title.trim().length === 0) return
    setSaving(true)
    try {
      await saveNote(householdId, { id: newUuid(), title, document: emptyNoteDocument() }, null)
      setTitle('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  function openNote(note: NoteSummary) {
    router.push({ pathname: '/notes/[noteId]', params: { noteId: note.id } })
  }

  async function confirmDelete() {
    if (!householdId || !deleting) return
    await deleteNote(householdId, deleting.id, deleting.revision)
    setDeleting(null)
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
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
            onDelete={() => setDeleting(item)}
          />
        )}
        ItemSeparatorComponent={() => <Text style={styles.separator} />}
      />

      <FloatingActionButton accessibilityLabel="New note" onPress={() => setAdding(true)} />

      <BottomSheet open={adding} onOpenChange={setAdding} title="New note">
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
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.title ?? 'note'}?`}
        description="This permanently removes the note."
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
