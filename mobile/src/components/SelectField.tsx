import { useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'
import { CheckIcon, ChevronDownIcon } from './icons'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectFieldProps {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
}

/** Labeled tap-to-open dropdown field — the RN equivalent of a web `<select>`. */
export function SelectField({ label, value, options, onChange, disabled }: SelectFieldProps) {
  const { tokens } = useTheme()
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <View>
      <Text style={[styles.label, { color: tokens.muted }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          { borderColor: tokens.line, borderRadius: tokens.radiusControl },
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.value, { color: tokens.ink }]} numberOfLines={1}>
          {selected?.label ?? 'Select…'}
        </Text>
        <ChevronDownIcon size={16} color={tokens.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: tokens.modal }, tokens.shadowFloat]}>
            <Text style={[styles.menuTitle, { color: tokens.muted }]}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(option) => option.value}
              style={styles.menuList}
              renderItem={({ item }) => {
                const active = item.value === value
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: item.disabled }}
                    onPress={() => {
                      // Deliberately not using Pressable's `disabled` prop here: that
                      // makes RN's responder system reject the touch, which lets it
                      // bubble to the backdrop `Pressable` behind this row and close
                      // the whole menu on tap. Claiming the touch and no-op'ing keeps
                      // the menu open, matching a native `<select>`'s disabled option.
                      if (item.disabled) return
                      onChange(item.value)
                      setOpen(false)
                    }}
                    style={[styles.menuItem, item.disabled && styles.disabled]}
                  >
                    <Text
                      style={[styles.menuItemText, { color: active ? tokens.accent : tokens.ink }]}
                    >
                      {item.label}
                    </Text>
                    {active ? <CheckIcon size={16} color={tokens.accent} /> : null}
                  </Pressable>
                )
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  disabled: { opacity: 0.6 },
  value: { fontSize: 15, flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  menu: { width: '100%', maxWidth: 360, maxHeight: '60%', borderRadius: 16, padding: 8 },
  menuTitle: { fontSize: 12.5, fontWeight: '600', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  menuList: { maxHeight: 320 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  menuItemText: { fontSize: 15, flex: 1 },
})
