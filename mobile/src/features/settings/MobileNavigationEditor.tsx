import { useRef, useState } from 'react'
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native'

import {
  DEFAULT_MOBILE_NAVIGATION,
  omittedDestination,
  replaceMobileDestination,
  type MobileNavigation,
} from '@/components/mobileNavigation'
import { TAB_DESTINATIONS } from '@/components/tabDestinations'
import { useTheme } from '@/theme/tokens'

const ROW_HEIGHT = 56
const ROW_GAP = 8

function destinationFor(key: MobileNavigation[number]) {
  return TAB_DESTINATIONS.find((item) => item.key === key)!
}

export function MobileNavigationEditor({
  value,
  saving,
  onSave,
}: {
  value: MobileNavigation | undefined
  saving: boolean
  onSave: (value: MobileNavigation) => Promise<void>
}) {
  const initialValue = value ?? DEFAULT_MOBILE_NAVIGATION
  return (
    <MobileNavigationDraftEditor
      key={initialValue.join(':')}
      initialValue={initialValue}
      saving={saving}
      onSave={onSave}
    />
  )
}

function MobileNavigationDraftEditor({
  initialValue,
  saving,
  onSave,
}: {
  initialValue: MobileNavigation
  saving: boolean
  onSave: (value: MobileNavigation) => Promise<void>
}) {
  const { tokens } = useTheme()
  const [draft, setDraft] = useState<MobileNavigation>(initialValue)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const dragY = useRef(new Animated.Value(0)).current
  const draftRef = useRef(draft)
  draftRef.current = draft

  function clampedTarget(gestureState: PanResponderGestureState, origin: number): number {
    const offset = Math.round(gestureState.dy / (ROW_HEIGHT + ROW_GAP))
    return Math.max(0, Math.min(2, origin + offset))
  }

  function makePanResponder(index: number) {
    const originRef = { current: index }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        originRef.current = index
        setDragIndex(index)
        dragY.setValue(0)
      },
      onPanResponderMove: (_event: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        dragY.setValue(gestureState.dy)
        const target = clampedTarget(gestureState, originRef.current)
        if (target !== index) {
          const current = draftRef.current
          const next = [...current]
          ;[next[index], next[target]] = [next[target], next[index]]
          setDraft(next as unknown as MobileNavigation)
          originRef.current = target
          dragY.setValue(0)
        }
      },
      onPanResponderRelease: () => {
        setDragIndex(null)
        dragY.setValue(0)
      },
      onPanResponderTerminate: () => {
        setDragIndex(null)
        dragY.setValue(0)
      },
    })
  }

  const panResponders = useRef([
    makePanResponder(0),
    makePanResponder(1),
    makePanResponder(2),
  ]).current

  const omitted = destinationFor(omittedDestination(draft))

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
      <View style={[styles.list, { height: 3 * ROW_HEIGHT + 2 * ROW_GAP }]}>
        {draft.map((key, index) => {
          const destination = destinationFor(key)
          const isDragging = dragIndex === index
          const Icon = destination.icon
          return (
            <Animated.View
              key={key}
              style={[
                styles.row,
                {
                  backgroundColor: tokens.cardAlt,
                  borderRadius: tokens.radiusControl,
                  top: index * (ROW_HEIGHT + ROW_GAP),
                  height: ROW_HEIGHT,
                  zIndex: isDragging ? 10 : 1,
                  transform: isDragging ? [{ translateY: dragY }] : [],
                },
                isDragging && [
                  styles.dragging,
                  {
                    borderColor: tokens.accent,
                    shadowColor: tokens.ink,
                  },
                ],
              ]}
            >
              <View style={styles.slotBadge}>
                <Text style={[styles.slotNumber, { color: tokens.muted }]}>
                  {index + 1}
                </Text>
              </View>
              <Icon size={22} color={tokens.ink} />
              <Text style={[styles.name, { color: tokens.ink }]}>
                {destination.label}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Swap ${destination.label} with ${omitted.label}`}
                hitSlop={6}
                onPress={() => setDraft(replaceMobileDestination(draft, index))}
                style={[styles.swapButton, { backgroundColor: tokens.card }]}
              >
                <Text style={[styles.swapText, { color: tokens.accent }]}>↕</Text>
              </Pressable>
              <View
                {...panResponders[index].panHandlers}
                style={styles.grip}
              >
                <Text style={[styles.gripBars, { color: tokens.muted }]}>☰</Text>
              </View>
            </Animated.View>
          )
        })}
      </View>

      <View style={[styles.omittedRow, { backgroundColor: tokens.card, borderRadius: tokens.radiusControl }]}>
        <Text style={[styles.omittedLabel, { color: tokens.muted }]}>
          In More menu
        </Text>
        <View style={styles.omittedInfo}>
          <omitted.icon size={18} color={tokens.muted} />
          <Text style={[styles.omittedName, { color: tokens.muted }]}>
            {omitted.label}
          </Text>
        </View>
      </View>

      <Text style={[styles.previewLabel, { color: tokens.muted }]}>Preview</Text>
      <View style={styles.previewBar}>
        <PreviewSlot label="Schedule" tokens={tokens} fixed />
        {draft.map((key) => (
          <PreviewSlot key={key} label={destinationFor(key).label} tokens={tokens} />
        ))}
        <PreviewSlot label="More" tokens={tokens} fixed />
      </View>

      {saveError ? <Text style={[styles.error, { color: tokens.danger }]}>{saveError}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save navigation"
        disabled={saving}
        onPress={() => void save()}
        style={[styles.save, { backgroundColor: tokens.accent, borderRadius: tokens.radiusControl }, saving && styles.disabled]}
      >
        <Text style={[styles.saveText, { color: tokens.accentContrast }]}>
          {saving ? 'Saving…' : 'Save navigation'}
        </Text>
      </Pressable>
    </View>
  )
}

function PreviewSlot({
  label,
  tokens,
  fixed,
}: {
  label: string
  tokens: ReturnType<typeof useTheme>['tokens']
  fixed?: boolean
}) {
  return (
    <View style={styles.previewSlot}>
      <View
        style={[
          styles.previewDot,
          { backgroundColor: fixed ? tokens.muted3 : tokens.accent },
        ]}
      />
      <Text
        style={[
          styles.previewSlotLabel,
          { color: fixed ? tokens.muted3 : tokens.ink },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { position: 'relative', marginBottom: 12 },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  dragging: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  slotBadge: {
    width: 20,
    alignItems: 'center',
  },
  slotNumber: { fontSize: 12, fontWeight: '700' },
  name: { flex: 1, fontSize: 15, fontWeight: '600' },
  swapButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  swapText: { fontSize: 16, fontWeight: '700' },
  grip: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gripBars: { fontSize: 20, lineHeight: 22 },
  omittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  omittedLabel: { fontSize: 12.5, fontWeight: '600' },
  omittedInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  omittedName: { fontSize: 14, fontWeight: '500' },
  previewLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  previewBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  previewSlot: { alignItems: 'center', gap: 3 },
  previewDot: { width: 6, height: 6, borderRadius: 3 },
  previewSlotLabel: { fontSize: 10 },
  error: { marginTop: 10, fontSize: 13 },
  save: { marginTop: 14, paddingVertical: 12, alignItems: 'center' },
  saveText: { fontWeight: '700' },
  disabled: { opacity: 0.6 },
})
