import type { RichNoteDocument } from '@household-hub/domain'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ChevronLeftIcon } from '@/components/icons'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { useNote, type Note } from '@/features/notes/data'
import { deleteNote, saveNote } from '@/features/notes/mutations'
import { RestrictedEditor } from '@/features/notes/RestrictedEditor'
import { RestrictedNoteView } from '@/features/notes/RestrictedNoteView'
import { operationOutcomeError } from '@/lib/operations'
import { useTheme } from '@/theme/tokens'

interface NoteDraft {
  title: string
  document: RichNoteDocument
}

/** One note in plain read mode, with explicit Edit/Save/Cancel drafting. */
export default function NoteScreen() {
  const { tokens } = useTheme()
  const router = useRouter()
  const { noteId } = useLocalSearchParams<{ noteId: string }>()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const query = useNote(householdId, noteId)
  const [draft, setDraft] = useState<NoteDraft | null>(null)
  const [localSaved, setLocalSaved] = useState<Note | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (query.isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]}>
        <LoadingState />
      </SafeAreaView>
    )
  }
  if (query.isError || !query.data) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]}>
        <ErrorState message="Could not load this note." onRetry={() => void query.refetch()} />
      </SafeAreaView>
    )
  }

  const saved =
    localSaved && localSaved.id === query.data.id && localSaved.revision > query.data.revision
      ? localSaved
      : query.data
  const editing = draft !== null

  function beginEditing() {
    setError(null)
    setDraft({ title: saved.title, document: saved.document })
  }

  async function handleSave() {
    if (!draft || !householdId || !noteId) return
    if (!draft.title.trim()) {
      setError('Enter a note title.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const outcome = await saveNote(
        householdId,
        { id: noteId, title: draft.title, document: draft.document },
        saved.revision,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        return
      }
      setLocalSaved({
        id: noteId,
        title: draft.title.trim(),
        document: draft.document,
        revision: saved.revision + 1,
      })
      setDraft(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!householdId || !noteId) return
    setBusy(true)
    setError(null)
    try {
      const outcome = await deleteNote(householdId, noteId, saved.revision)
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setError(outcomeError)
        setConfirmDelete(false)
        return
      }
      router.replace('/notes')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.canvas }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.replace('/notes')} style={styles.backRow}>
            <ChevronLeftIcon size={16} color={tokens.muted} />
            <Text style={[styles.backLabel, { color: tokens.muted }]}>All notes</Text>
          </Pressable>

          <View style={styles.titleRow}>
            {editing ? (
              <Text style={[styles.pageTitle, { color: tokens.ink }]}>Edit note</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit note title"
                onPress={beginEditing}
                style={styles.titleButton}
              >
                <Text style={[styles.pageTitle, { color: tokens.ink }]} numberOfLines={1}>
                  {saved.title || 'Note'}
                </Text>
              </Pressable>
            )}
            {editing ? (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    setDraft(null)
                    setError(null)
                  }}
                >
                  <Text style={[styles.actionText, { color: tokens.muted }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void handleSave()}
                  style={[styles.saveChip, { backgroundColor: tokens.accent }]}
                >
                  <Text style={[styles.saveChipText, { color: tokens.accentContrast }]}>Save</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={beginEditing}>
                  <Text style={[styles.actionText, { color: tokens.accent }]}>Edit</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)}>
                  <Text style={[styles.actionText, { color: tokens.danger }]}>Delete</Text>
                </Pressable>
              </View>
            )}
          </View>

          {editing && draft ? (
            <>
              <TextInput
                accessibilityLabel="Note title"
                value={draft.title}
                onChangeText={(title) => setDraft((current) => (current ? { ...current, title } : current))}
                autoFocus
                style={[
                  styles.titleInput,
                  { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
                ]}
              />
              <View
                style={[
                  styles.editorCard,
                  { backgroundColor: tokens.card, borderRadius: tokens.radiusCard },
                ]}
              >
                <RestrictedEditor
                  content={draft.document}
                  onChange={(document) =>
                    setDraft((current) => (current ? { ...current, document } : current))
                  }
                />
              </View>
            </>
          ) : (
            <View style={styles.readArea}>
              <RestrictedNoteView document={saved.document} />
            </View>
          )}

          {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this note?"
        description="This permanently removes the note. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10 },
  backLabel: { fontSize: 13, fontWeight: '600' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  titleButton: { flex: 1 },
  pageTitle: { fontSize: 22, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionText: { fontSize: 14, fontWeight: '600' },
  saveChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  saveChipText: { fontSize: 14, fontWeight: '700' },
  titleInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  editorCard: { flex: 1, minHeight: 360, overflow: 'hidden' },
  readArea: { flex: 1, paddingTop: 4 },
  error: { fontSize: 13, marginTop: 12 },
})
