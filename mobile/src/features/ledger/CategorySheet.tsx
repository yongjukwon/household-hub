import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '@/components/BottomSheet'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { centsToInputValue, parseDollarsToCents } from '@/features/moneyInput'
import {
  operationOutcomeError,
  operationThrownError,
} from '@/lib/operations'
import { newUuid } from '@/lib/uuid'
import { useTheme } from '@/theme/tokens'
import type { CategoryKind, CategoryProgress } from './statements'
import { deleteCategory, saveCategory, saveLimit } from './statementMutations'

interface CategorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  householdId: string
  yearId: string
  month: number
  /** The existing category row for this month, or null to create. */
  existing: CategoryProgress | null
  /** Next sort order to use for a new category. */
  nextSortOrder: number
  /** Preselects the kind when category creation begins from a transaction. */
  initialKind?: CategoryKind
  /** Called only after every required operation is accepted. */
  onSaved?: (kind: CategoryKind) => void
}

/**
 * Create or edit a category and its monthly limit, applied from the selected
 * month forward. Deleting is blocked server-side if this or a later month has
 * spending (surfaced as a discard warning).
 */
export function CategorySheet({
  open,
  onOpenChange,
  householdId,
  yearId,
  month,
  existing,
  nextSortOrder,
  initialKind,
  onSaved,
}: CategorySheetProps) {
  const { tokens } = useTheme()
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<CategoryKind>(
    existing?.kind ?? initialKind ?? 'spending',
  )
  const [limit, setLimit] = useState(centsToInputValue(existing?.limitCents ?? null))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (name.trim().length === 0) return
    setSaving(true)
    setError(null)
    try {
      const categoryId = existing?.categoryId ?? newUuid()
      const categoryOutcome = await saveCategory(
        householdId,
        {
          id: categoryId,
          yearId,
          fromMonth: month,
          name,
          kind,
          sortOrder: existing?.sortOrder ?? nextSortOrder,
        },
        existing?.revision ?? null,
      )
      const categoryError = operationOutcomeError(categoryOutcome)
      if (categoryError) {
        setError(categoryError)
        return
      }
      if (kind === 'spending') {
        const cents = parseDollarsToCents(limit)
        const limitOutcome = await saveLimit(
          householdId,
          categoryId,
          categoryId,
          month,
          cents,
          null,
        )
        const limitError = operationOutcomeError(limitOutcome)
        if (limitError) {
          setError(limitError)
          return
        }
      }
      onSaved?.(kind)
      onOpenChange(false)
    } catch (failure) {
      setError(operationThrownError(failure, 'Could not save this category.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    setSaving(true)
    setError(null)
    try {
      const outcome = await deleteCategory(
        householdId,
        existing.categoryId,
        month,
        existing.revision,
      )
      const outcomeError = operationOutcomeError(outcome)
      if (outcomeError) {
        setConfirmDelete(false)
        setError(outcomeError)
        return
      }
      setConfirmDelete(false)
      onOpenChange(false)
    } catch (failure) {
      setConfirmDelete(false)
      setError(operationThrownError(failure, 'Could not delete this category.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={existing ? 'Edit category' : 'New category'}>
      <View style={styles.field}>
        <Text style={[styles.label, { color: tokens.muted }]}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          autoFocus
          style={[
            styles.input,
            { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
          ]}
        />
      </View>
      <View style={styles.kindRow}>
        {(['spending', 'income'] as CategoryKind[]).map((k) => {
          const active = kind === k
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              disabled={!!existing}
              onPress={() => setKind(k)}
              style={[
                styles.kindChip,
                { backgroundColor: active ? tokens.accent : tokens.cardAlt },
                !!existing && styles.disabled,
              ]}
            >
              <Text style={[styles.kindText, { color: active ? tokens.accentContrast : tokens.muted }]}>
                {k[0].toUpperCase() + k.slice(1)}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {kind === 'spending' ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: tokens.muted }]}>Monthly limit (optional)</Text>
          <TextInput
            accessibilityLabel="Monthly limit"
            value={limit}
            onChangeText={setLimit}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={tokens.muted3}
            style={[
              styles.input,
              { borderColor: tokens.line, borderRadius: tokens.radiusControl, color: tokens.ink },
            ]}
          />
        </View>
      ) : null}
      <Text style={[styles.hint, { color: tokens.muted }]}>Applies from this month forward.</Text>
      {error ? <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => void handleSave()}
          style={[
            styles.saveButton,
            { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl },
            saving && styles.disabled,
          ]}
        >
          <Text style={[styles.saveButtonText, { color: tokens.accentContrast }]}>Save</Text>
        </Pressable>
        {existing ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => setConfirmDelete(true)}
            style={[styles.deleteButton, saving && styles.disabled]}
          >
            <Text style={[styles.deleteButtonText, { color: tokens.danger }]}>Delete</Text>
          </Pressable>
        ) : null}
      </View>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete category?"
        description="Removes it from this month forward. Blocked if a later month already has spending."
        error={confirmDelete ? error : null}
        confirmLabel="Delete"
        confirmDisabled={saving}
        onConfirm={() => void handleDelete()}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  kindChip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  kindText: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, marginBottom: 14 },
  error: { fontSize: 13, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  saveButton: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  deleteButtonText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
