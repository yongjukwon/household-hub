import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'
import { Card } from './Card'

/** Neutral loading placeholder. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { tokens } = useTheme()
  return (
    <Text
      accessibilityRole="text"
      style={[styles.loading, { color: tokens.muted }]}
    >
      {label}
    </Text>
  )
}

/** Empty-list state with an optional call to action. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  const { tokens } = useTheme()
  return (
    <Card style={styles.emptyCard}>
      <Text style={[styles.emptyTitle, { color: tokens.ink }]}>{title}</Text>
      {hint ? (
        <Text style={[styles.emptyHint, { color: tokens.muted }]}>{hint}</Text>
      ) : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </Card>
  )
}

/** Error state with an optional retry. */
export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  const { tokens } = useTheme()
  return (
    <View accessibilityRole="alert" style={styles.errorWrap}>
      <Text style={[styles.errorText, { color: tokens.danger }]}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={[
            styles.retryButton,
            {
              backgroundColor: tokens.control,
              borderRadius: tokens.radiusControl,
            },
            tokens.shadowCard,
          ]}
        >
          <Text style={[styles.retryText, { color: tokens.ink }]}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  loading: { textAlign: 'center', fontSize: 14, paddingVertical: 48 },
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontWeight: '700', fontSize: 15 },
  emptyHint: {
    marginTop: 4,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyAction: { marginTop: 16 },
  errorWrap: { paddingVertical: 48, alignItems: 'center' },
  errorText: { fontSize: 14 },
  retryButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { fontSize: 14, fontWeight: '600' },
})
