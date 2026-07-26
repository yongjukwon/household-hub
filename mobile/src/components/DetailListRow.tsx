import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { useTheme } from '@/theme/tokens'
import { TrashIcon } from './icons'
import { ListCard } from './ListCard'

interface DetailListRowProps {
  title: string
  subtitle?: string
  openLabel: string
  deleteLabel: string
  onOpen: () => void
  onDelete: () => void
  secondaryAction?: {
    label: string
    icon: ReactNode
    onPress: () => void
    expanded?: boolean
  }
}

/** A detail-link row whose destructive and optional secondary actions never navigate. */
export function DetailListRow({
  title,
  subtitle,
  openLabel,
  deleteLabel,
  onOpen,
  onDelete,
  secondaryAction,
}: DetailListRowProps) {
  const { tokens } = useTheme()

  return (
    <ListCard style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={openLabel}
        onPress={onOpen}
        style={styles.main}
      >
        <Text style={[styles.title, { color: tokens.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: tokens.muted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </Pressable>

      {secondaryAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={secondaryAction.label}
          accessibilityState={{ expanded: secondaryAction.expanded }}
          onPress={secondaryAction.onPress}
          style={[styles.iconButton, { backgroundColor: tokens.cardAlt }]}
        >
          {secondaryAction.icon}
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={deleteLabel}
        onPress={onDelete}
        style={[styles.iconButton, { backgroundColor: tokens.cardAlt }]}
      >
        <TrashIcon size={18} color={tokens.danger} />
      </Pressable>
    </ListCard>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  main: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 13, marginTop: 2 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
