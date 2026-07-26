import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/theme/tokens'
import { XIcon } from './icons'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}

/** Modal sheet anchored to the bottom, used for create/edit forms. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: BottomSheetProps) {
  const { tokens } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={() => onOpenChange(false)}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close"
          onPress={() => onOpenChange(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: tokens.card,
                paddingBottom: insets.bottom + 20,
              },
              tokens.shadowFloat,
            ]}
          >
            <View style={styles.grabberRow}>
              <View
                style={[styles.grabber, { backgroundColor: tokens.line }]}
              />
            </View>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: tokens.ink }]}>
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => onOpenChange(false)}
                hitSlop={8}
              >
                <XIcon size={20} color={tokens.muted} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetWrap: { maxHeight: '90%' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabberRow: { alignItems: 'center', paddingVertical: 8 },
  grabber: { width: 36, height: 4, borderRadius: 2 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '800' },
  content: { paddingBottom: 8 },
})
