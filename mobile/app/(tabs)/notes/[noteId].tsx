import type { RichNoteDocument } from '@household-hub/domain'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAppChrome } from '@/components/AppChrome'
import { ErrorState, LoadingState } from '@/components/states'
import { useActiveHousehold } from '@/features/household'
import { useNote, type Note } from '@/features/notes/data'
import { saveNote } from '@/features/notes/mutations'
import { RestrictedEditor } from '@/features/notes/RestrictedEditor'
import { RestrictedNoteView } from '@/features/notes/RestrictedNoteView'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { useTheme } from '@/theme/tokens'

interface NoteDraft {
  title: string
  document: RichNoteDocument
}

/** One note in plain read mode, with explicit Edit/Save/Cancel drafting. */
export default function NoteScreen() {
  const { tokens } = useTheme()
  const { noteId } = useLocalSearchParams<{ noteId: string }>()
  const household = useActiveHousehold()
  const householdId = household.data?.id
  const query = useNote(householdId, noteId)
  const [draft, setDraft] = useState<NoteDraft | null>(null)
  const [localSaved, setLocalSaved] = useState<Note | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved =
    query.data && localSaved && localSaved.id === query.data.id && localSaved.revision > query.data.revision
      ? localSaved
      : query.data
  const editing = draft !== null

  function beginEditing() {
    if (!saved) return
    setError(null)
    setDraft({ title: saved.title, document: saved.document })
  }

  async function handleSave() {
    if (!draft || !householdId || !noteId || !saved) return
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
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not save this note.'))
    } finally {
      setBusy(false)
    }
  }

  useAppChrome({
    mode: editing ? 'editing' : 'detail',
    title: editing && draft ? (
      <TextInput
        accessibilityLabel="Note title"
        value={draft.title}
        onChangeText={(title) => setDraft((current) => (current ? { ...current, title } : current))}
        autoFocus
        style={[
          styles.chromeTitleInput,
          { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
        ]}
      />
    ) : (saved?.title || 'Note'),
    onEdit: saved ? beginEditing : undefined,
    onCancel: editing ? () => {
      setDraft(null)
      setError(null)
    } : undefined,
    onSave: editing ? () => void handleSave() : undefined,
    saveDisabled: busy,
  })

  if (query.isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
        <LoadingState />
      </SafeAreaView>
    )
  }
  if (query.isError || !saved) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]}>
        <ErrorState message="Could not load this note." onRetry={() => void query.refetch()} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {editing && draft ? (
            <>
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

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  chromeTitleInput: {
    width: 220,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '700',
  },
  editorCard: { flex: 1, minHeight: 360 },
  readArea: { flex: 1, paddingTop: 4 },
  error: { fontSize: 13, marginTop: 12 },
})
