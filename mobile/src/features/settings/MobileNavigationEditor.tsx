import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
  DEFAULT_MOBILE_NAVIGATION,
  moveMobileDestination,
  replaceMobileDestination,
  type MobileNavigation,
} from '@/components/mobileNavigation'
import { TAB_DESTINATIONS } from '@/components/tabDestinations'
import { useTheme } from '@/theme/tokens'

const labelFor = (key: MobileNavigation[number]) =>
  TAB_DESTINATIONS.find((item) => item.key === key)?.label ?? key

export function MobileNavigationEditor({
  value,
  saving,
  onSave,
}: {
  value: MobileNavigation | undefined
  saving: boolean
  onSave: (value: MobileNavigation) => Promise<void>
}) {
  const { tokens } = useTheme()
  const [draft, setDraft] = useState<MobileNavigation>(value ?? DEFAULT_MOBILE_NAVIGATION)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (value) setDraft(value)
  }, [value])

  async function save() {
    setSaveError(null)
    try {
      await onSave(draft)
    } catch {
      setSaveError('Could not save navigation.')
    }
  }

  return (
    <View>
      {draft.map((key, index) => (
        <View key={key} style={styles.row}>
          <Text style={[styles.name, { color: tokens.ink }]}>{labelFor(key)}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${labelFor(key)} up`}
              disabled={index === 0}
              onPress={() => setDraft(moveMobileDestination(draft, index, -1))}
            >
              <Text style={[styles.action, { color: index === 0 ? tokens.muted3 : tokens.muted }]}>Move Up</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${labelFor(key)} down`}
              disabled={index === 2}
              onPress={() => setDraft(moveMobileDestination(draft, index, 1))}
            >
              <Text style={[styles.action, { color: index === 2 ? tokens.muted3 : tokens.muted }]}>Move Down</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Replace ${labelFor(key)}`}
              onPress={() => setDraft(replaceMobileDestination(draft, index))}
            >
              <Text style={[styles.action, { color: tokens.accent }]}>Replace</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Text style={[styles.previewLabel, { color: tokens.muted }]}>Preview</Text>
      <Text accessibilityLabel="Navigation preview" style={[styles.preview, { color: tokens.ink }]}>Schedule · {draft.map(labelFor).join(' · ')} · More</Text>
      {saveError ? <Text style={[styles.error, { color: tokens.danger }]}>{saveError}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save navigation"
        disabled={saving}
        onPress={() => void save()}
        style={[styles.save, { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl }, saving && styles.disabled]}
      >
        <Text style={[styles.saveText, { color: tokens.accentContrast }]}>Save</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { paddingVertical: 10, gap: 8 },
  name: { fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 16 },
  action: { fontSize: 12, fontWeight: '600' },
  previewLabel: { marginTop: 12, fontSize: 12, fontWeight: '700' },
  preview: { marginTop: 5, fontSize: 13 },
  error: { marginTop: 10, fontSize: 13 },
  save: { marginTop: 14, paddingVertical: 12, alignItems: 'center' },
  saveText: { fontWeight: '700' },
  disabled: { opacity: 0.6 },
})
