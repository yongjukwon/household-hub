import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BottomSheet } from '@/components/BottomSheet'
import { Card } from '@/components/Card'
import { ChevronRightIcon, PlusIcon } from '@/components/icons'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { emptyNoteDocument, useNotes, type NoteSummary } from '@/features/notes/data'
import { saveNote } from '@/features/notes/mutations'
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
      <FlatList
        data={notes.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New note"
              onPress={() => setAdding(true)}
              style={[styles.addButton, { backgroundColor: tokens.accent }]}
            >
              <PlusIcon size={18} color={tokens.accentContrast} />
            </Pressable>
          </View>
        }
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
          <Pressable onPress={() => openNote(item)} style={styles.rowWrap}>
            <Card style={styles.row}>
              <Text style={[styles.rowLabel, { color: tokens.ink }]} numberOfLines={1}>
                {item.title}
              </Text>
              <ChevronRightIcon size={18} color={tokens.muted} />
            </Card>
          </Pressable>
        )}
      />

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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 24, flexGrow: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
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
    gap: 8,
  },
  rowLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  createButton: { paddingVertical: 13, alignItems: 'center' },
  createButtonText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
})
